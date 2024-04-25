/*global wm, WM, Blob, FormData, Array, _, navigator*/
/*jslint todo: true */
/*jslint sub: true */


/**
 * @ngdoc service
 * @name wm.variables.$servicevariable
 * @requires $rootScope
 * @requires BaseVariablePropertyFactory
 * @description
 * The '$servicevariable' provides methods to work with service variables
 */

wm.variables.services.$servicevariable = ['Variables',
    'BaseVariablePropertyFactory',
    'WebService',
    'ServiceFactory',
    '$rootScope',
    'CONSTANTS',
    'Utils',
    'ProjectService',
    'VARIABLE_CONSTANTS',
    'WS_CONSTANTS',
    '$timeout',
    '$base64',
    'SWAGGER_CONSTANTS',
    'oAuthProviderService',
    'SecurityService',
    'BaseService',

    function (Variables, BaseVariablePropertyFactory, WebService, ServiceFactory, $rootScope, CONSTANTS, Utils, ProjectService, VARIABLE_CONSTANTS, WS_CONSTANTS, $timeout, $base64, SWAGGER_CONSTANTS, oAuthProviderService, SecurityService, BaseService) {
        "use strict";

        var requestQueue = {},
            variableActive = {},
            prefabDataTypes = {},
            methods                 = {},
            serviceVariableObj      = {},
            REST_METHOD_NAME = "executeRestCall",
            REST_SUPPORTED_SERVICES = VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES,
            SERVICE_TYPE_REST = VARIABLE_CONSTANTS.SERVICE_TYPE_REST,
            AUTH_TYPE_BASIC = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE_BASIC,
            AUTH_TYPE_NONE = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE_NONE,
            SECURITY_DEFINITIONS_TYPE_OAUTH = VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_OAUTH2,
            SECURITY_DEFINITIONS_TYPE_BASIC = VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_BASIC,
            supportedOperations = WS_CONSTANTS.HTTP_METHODS.map(function (method) { return method.toLowerCase(); }),
            BASE_PATH_KEY = VARIABLE_CONSTANTS.REST_SERVICE.BASE_PATH_KEY,
            RELATIVE_PATH_KEY = VARIABLE_CONSTANTS.REST_SERVICE.RELATIVE_PATH_KEY,
            OAUTH_PROVIDER_KEY = VARIABLE_CONSTANTS.REST_SERVICE.OAUTH_PROVIDER_KEY,
            CONTROLLER_KEY = 'x-WM-TAG',
            parameterTypeKey = 'in',
            AUTH_HDR_KEY = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_HDR_KEY,
            CONTROLLER_TYPE_QUERY = 'QueryExecution',
            ERR_TYPE_NO_ACCESSTOKEN = 'missing_accesstoken',
            initiateCallback = Variables.initiateCallback,/*function to initiate the callback and obtain the data for the callback variable.*/
            processRequestQueue = Variables.processRequestQueue;

        function isPrimitiveType(type, modelTypes) {
            return (WS_CONSTANTS.PRIMITIVE_DATA_TYPES.indexOf(type) !== -1)
                || _.get(modelTypes, '["' + type + '"].primitiveType')
                || _.isEmpty(_.get(modelTypes, '["' + type + '"].fields'));
        }

        /**
         * function to prepare the sample model for the service variable
         * @param type
         * @param parentNode
         * @param startNode
         * @param variable
         * @param typeChain
         */
        function prepareServiceModel(type, parentNode, startNode, variable, typeChain) {
            var modelTypes = variable._prefabName ? prefabDataTypes[variable._prefabName] : $rootScope.dataTypes,
                typeChainArr;
            /*if startNode variable is provided, skip till the startNode variable is reached*/
            if (startNode) {
                if (modelTypes[type] && modelTypes[type].fields) {
                    WM.forEach(modelTypes[type].fields, function (field, fieldName) {
                        /*if start node found, start preparing the data*/
                        if (fieldName === startNode) {
                            prepareServiceModel(field.type, parentNode, null, variable);
                        } else {
                            prepareServiceModel(field.type, parentNode, startNode, variable);
                        }
                    });
                }
            } else if (_.isUndefined(typeChain) && isPrimitiveType(type, modelTypes)) {//Set flag to true only if its parent node
                if (!variable.isList) {
                    parentNode['value'] = '';
                }
                variable._buildTreeFromDataSet = true;
            } else if (type && modelTypes[type]) {
                typeChain = typeChain || "";
                typeChainArr = typeChain.split("~");
                if (typeChainArr.indexOf(type) !== -1) {
                    return;
                }
                typeChain += "~" + type;
                WM.forEach(modelTypes[type].fields, function (field, fieldName) {
                    /* if the field is of type list and variable is not a service variable, skip it.
                     * skipping as it is resulting in endless recursive loop for DataServices
                     */
                    if (modelTypes[field.type] && modelTypes[field.type].fields) {
                        //Exempting procedure variables as cursor might return array of objects
                        if (variable.serviceType === 'DataService' && _.get(modelTypes[type].fields, [fieldName, 'isList']) && variable.controller !== 'ProcedureExecution') {
                            return;
                        }
                        parentNode[fieldName] = field.isList ? [{}] : {};
                        prepareServiceModel(field.type, field.isList ? parentNode[fieldName][0] : parentNode[fieldName], '', variable, typeChain);
                    } else {
                        parentNode[fieldName] = field.isList ? [] : '';
                    }
                });
            }
        }

        /*
         * function to transform the service data as according to the variable configuration
         * @param data: data returned from the service
         * @variable: variable object triggering the service
         */
        function transformData(data, variable) {
            data.wmTransformedData = [];

            var columnsArray = variable.transformationColumns,
                dataArray = data[variable.dataField] || [],
                transformedData = data.wmTransformedData;

            WM.forEach(dataArray, function (datum, index) {
                transformedData[index] = {};
                WM.forEach(columnsArray, function (column, columnIndex) {
                    transformedData[index][column] = datum[columnIndex];
                });
            });

            return data;
        }

        /**
         * Goes though request headers, appends 'X-' to certain headers
         * these headers need not be processed at proxy server and should directly be passed to the server
         * e.g. Authorization, Cookie, etc.
         * @param headers
         * @returns {{}}
         */
        function cloakHeadersForProxy(headers) {
            var _headers = {},
                UNCLOAKED_HEADERS = ['CONTENT-TYPE', 'ACCEPT', 'CONTENT-LENGTH', 'ACCEPT-ENCODING', 'ACCEPT-LANGUAGE'],
                CLOAK_PREFIX = 'X-WM-';
            WM.forEach(headers, function (val, key) {
                if (_.includes(UNCLOAKED_HEADERS, key.toUpperCase())) {
                    _headers[key] = val;
                } else {
                    _headers[CLOAK_PREFIX + key] = val;
                }
            });

            return _headers;
        }

        function isQueryServiceVar(variable) {
            return variable.controller === CONTROLLER_TYPE_QUERY && variable.serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE_DATA;
        }
        /*
        * Check for missing required params and format the date/time param values
        * */
        function processRequestBody(inputData, params) {
            var requestBody   = {},
                missingParams = [],
                paramValue;
            _.forEach(params, function (param) {
                paramValue = _.get(inputData, param.name);
                if (WM.isDefined(paramValue) && (paramValue !== '') && !param.readOnly) {
                    paramValue = Utils.isDateTimeType(param.type) ? Utils.formatDate(paramValue, param.type) : paramValue;
                    //Construct ',' separated string if param is not array type but value is an array
                    if (WM.isArray(paramValue) && _.toLower(Utils.extractType(param.type)) === 'string') {
                        paramValue = _.join(paramValue, ',');
                    }
                    requestBody[param.name] = paramValue;
                } else if (param.required) {
                    missingParams.push(param.name || param.id);
                }
            });
            return {
                'requestBody'   : requestBody,
                'missingParams' : missingParams
            };
        }
        /**
         * function to create the params to invoke the java service. creating the params and the corresponding
         * url to invoke based on the type of the parameter
         * @param operationInfo
         * @param variable
         * @param inputFields to be considered for body type query/procedure variables
         * @returns {*}
         */
        function constructRestRequestParams(operationInfo, variable, inputFields) {
            variable = variable || {};
            var queryParams = '',
                directPath = operationInfo.directPath || '',
                relativePath = operationInfo.basePath ? operationInfo.basePath + operationInfo.relativePath : operationInfo.relativePath,
                bodyInfo,
                headers = {},
                requestBody,
                nonFileTypeParams = {},
                url,
                requiredParamMissing = [],
                target,
                pathParamRex,
                invokeParams,
                authDetails = null,
                uname,
                pswd,
                method,
                formData,
                isProxyCall,
                isBodyTypeQueryProcedure = ServiceFactory.isBodyTypeQueryProcedure(variable),
                paramValueInfo,
                params,
                securityDefnObj,
                accessToken;
            function getFormDataObj() {
                if (formData) {
                    return formData;
                }
                formData = new FormData();
                return formData;
            }
            //function checks whether the test parameters are given and valid or not
            function isValidParamValue(paramValue, paramType) {
                return WM.isDefined(paramValue) && ((paramValue !== null && paramValue !== '') || (isBodyTypeQueryProcedure && paramType !== 'file'));
            }

            securityDefnObj = _.get(operationInfo.securityDefinitions, '0');

            if (securityDefnObj && securityDefnObj.type === SECURITY_DEFINITIONS_TYPE_OAUTH) {
                accessToken = oAuthProviderService.getAccessToken(securityDefnObj[OAUTH_PROVIDER_KEY]);
                if (accessToken) {
                    headers[AUTH_HDR_KEY] = 'Bearer ' + accessToken;
                } else {
                    return {
                        'error': {
                            'type' : ERR_TYPE_NO_ACCESSTOKEN
                        },
                        'securityDefnObj': securityDefnObj
                    };
                }
            }
            operationInfo.proxySettings = operationInfo.proxySettings || {web: true, mobile: false};
            method                      = operationInfo.httpMethod || operationInfo.methodType;
            isProxyCall                 = (function () {
                if (CONSTANTS.hasCordova) {
                    return operationInfo.proxySettings.mobile;
                }
                return operationInfo.proxySettings.web;
            }());
            url                         = isProxyCall ? relativePath : directPath;

            /* loop through all the parameters */
            _.forEach(operationInfo.parameters, function (param) {
                //Set params based on current workspace
                function setParamsOfChildNode() {
                    if (inputFields) {
                        paramValueInfo =  inputFields;
                        params = _.get(operationInfo, ['definitions', param.type]);
                    } else {
                        //For Api Designer
                        paramValueInfo =  paramValue || {};
                        params = param.children;
                    }
                }
                var paramValue = param.sampleValue;

                if (isValidParamValue(paramValue, param.type)) {
                    //Format dateTime params for dataService variables
                    if (variable.serviceType === 'DataService' && Utils.isDateTimeType(param.type)) {
                        paramValue = Utils.formatDate(paramValue, param.type);
                    }
                    //Construct ',' separated string if param is not array type but value is an array
                    if (WM.isArray(paramValue) && _.toLower(Utils.extractType(param.type)) === 'string' && variable.serviceType === 'DataService') {
                        paramValue = _.join(paramValue, ',');
                    }
                    switch (param.parameterType.toUpperCase()) {
                    case 'QUERY':
                        //Ignore null valued query params for queryService variable
                        if (_.isNull(paramValue) && isQueryServiceVar(variable)) {
                            break;
                        }
                        if (!queryParams) {
                            queryParams = "?" + param.name + "=" + encodeURIComponent(paramValue);
                        } else {
                            queryParams += "&" + param.name + "=" + encodeURIComponent(paramValue);
                        }
                        break;
                    case 'AUTH':
                        if (param.name === 'wm_auth_username') {
                            uname = paramValue;
                        } else if (param.name === 'wm_auth_password') {
                            pswd = paramValue;
                        }
                        if (uname && pswd) {
                            headers[AUTH_HDR_KEY] = "Basic " + $base64.encode(uname + ':' + pswd);
                            authDetails = {
                                'type': AUTH_TYPE_BASIC
                            };
                        }
                        break;
                    case 'PATH':
                        /* replacing the path param based on the regular expression in the relative path */
                        pathParamRex = new RegExp("\\s*\\{\\s*" + param.name + "(:\\.\\+)?\\s*\\}\\s*");
                        url = url.replace(pathParamRex, paramValue);
                        break;
                    case 'HEADER':
                        headers[param.name] = paramValue;
                        break;
                    case 'BODY':
                        //For post/put query methods wrap the input
                        if (isBodyTypeQueryProcedure) {
                            setParamsOfChildNode();
                            bodyInfo = processRequestBody(paramValueInfo, params);
                            requestBody = bodyInfo.requestBody;
                            requiredParamMissing = _.concat(requiredParamMissing, bodyInfo.missingParams);
                        } else {
                            requestBody = paramValue;
                        }
                        break;
                    case 'FORMDATA':
                        if (isBodyTypeQueryProcedure && param.name === SWAGGER_CONSTANTS.WM_DATA_JSON) {
                            setParamsOfChildNode();
                            //Process query/procedure formData non-file params params
                            bodyInfo = processRequestBody(paramValueInfo, params);
                            requestBody = Utils.getFormData(getFormDataObj(), param, bodyInfo.requestBody);
                            requiredParamMissing = _.concat(requiredParamMissing, bodyInfo.missingParams);
                        } else {
                            requestBody = Utils.getFormData(getFormDataObj(), param, paramValue);
                        }
                        break;
                    }
                } else if (param.required) {
                    requiredParamMissing.push(param.name || param.id);
                }
            });

            // if required param not found, return error
            requiredParamMissing = requiredParamMissing.join(', ');
            if (requiredParamMissing) {
                return {
                    'error': {
                        'type'                    : 'required_field_missing',
                        'field'                   : requiredParamMissing,
                        'message'                 : 'Required field(s) missing: "' + requiredParamMissing + '"',
                        'skipDefaultNotification' : true
                    }
                };
            }

            // Setting appropriate content-Type for request accepting request body like POST, PUT, etc
            if (!_.includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, _.toUpper(method))) {
                /*Based on the formData browser will automatically set the content type to 'multipart/form-data' and webkit boundary*/
                if (operationInfo.consumes && (operationInfo.consumes[0] === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA)) {
                    headers['Content-Type'] = undefined;
                } else {
                    headers['Content-Type'] = (operationInfo.consumes && operationInfo.consumes[0]) || 'application/json';
                }
            }

            // if the consumes has application/x-www-form-urlencoded and
            // if the http request of given method type can have body send the queryParams as Form Data
            if (_.includes(operationInfo.consumes, WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED)
                && !_.includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, (method || '').toUpperCase())) {
                // remove the '?' at the start of the queryParams
                if (queryParams) {
                    requestBody = (requestBody ? requestBody + '&' : '') + queryParams.substring(1);
                }
                headers['Content-Type'] = WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED;
            } else {
                url += queryParams;
            }

            /*
             * for proxy calls:
             *  - cloak the proper headers (required only for REST services)
             *  - prepare complete url from relativeUrl
             */
            if (isProxyCall) {
                //avoiding cloakHeadersForProxy when the method is invoked from apidesigner.
                headers = variable.serviceType !== SERVICE_TYPE_REST || operationInfo.skipCloakHeaders ? headers : cloakHeadersForProxy(headers);
                if (variable._prefabName && REST_SUPPORTED_SERVICES.indexOf(variable.serviceType) !== -1 && variable._wmServiceOperationInfo) {
                    /* if it is a prefab variable (used in a normal project), modify the url */
                    url = "/prefabs/" + variable._prefabName + url;
                    target = "invokePrefabRestService";
                } else if (!variable._prefabName) {
                    url = '/services' + url;
                }
                url = $rootScope.project.deployedUrl + url;
            }

            /*creating the params needed to invoke the service. url is generated from the relative path for the operation*/
            invokeParams = {
                "projectID": $rootScope.project.id,
                "url": url,
                "target": target,
                "method": method,
                "headers": headers,
                "dataParams": requestBody,
                "authDetails": authDetails,
                "isDirectCall": !isProxyCall,
                "isExtURL": variable.serviceType === SERVICE_TYPE_REST
            };

            return invokeParams;
        }

        /**
         * function to process error response from a service
         */
        function processErrorResponse(variable, errMsg, errorCB, xhrObj, skipNotification, skipDefaultNotification) {
            // EVENT: ON_ERROR
            if (!skipNotification) {
                initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, variable, errMsg, xhrObj, skipDefaultNotification);
            }
            var methodInfo = getMethodInfo(variable, {}, {}),
                securityDefnObj = _.get(methodInfo, 'securityDefinitions.0');
            if (_.get(methodInfo.securityDefinitions, '0.type') === VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_OAUTH2 && _.includes([WS_CONSTANTS.HTTP_STATUS_CODE.UNAUTHORIZED, WS_CONSTANTS.HTTP_STATUS_CODE.FORBIDDEN], _.get(xhrObj, 'status'))) {
                oAuthProviderService.removeAccessToken(securityDefnObj[OAUTH_PROVIDER_KEY]);
            }
            /* trigger error callback */
            Utils.triggerFn(errorCB, errMsg);

            if (CONSTANTS.isRunMode) {
                /* process next requests in the queue */
                variableActive[variable.activeScope.$id][variable.name] = false;
                variable.canUpdate = true;
                processRequestQueue(variable, requestQueue[variable.activeScope.$id], getDataInRun);

                // EVENT: ON_CAN_UPDATE
                initiateCallback(VARIABLE_CONSTANTS.EVENT.CAN_UPDATE, variable, errMsg, xhrObj);
            }
        }

        /**
         * function to process success response from a service
         * @param response
         * @param variable
         * @param options
         * @param success
         */
        function processSuccessResponse(response, variable, options, success) {
            var newDataSet;

            response = Utils.getValidJSON(response) || Utils.xmlToJson(response) || response;

            // EVENT: ON_RESULT
            initiateCallback(VARIABLE_CONSTANTS.EVENT.RESULT, variable, response, options.xhrObj);

            /* if dataTransformation enabled, transform the data */
            if (variable.transformationColumns) {
                response = transformData(response, variable);
            }

            // EVENT: ON_PREPARE_SETDATA
            newDataSet = initiateCallback(VARIABLE_CONSTANTS.EVENT.PREPARE_SETDATA, variable, response, options.xhrObj);
            if (WM.isDefined(newDataSet)) {
                //setting newDataSet as the response to service variable onPrepareSetData
                response = newDataSet;
            }

            /* update the dataset against the variable, if response is non-object, insert the response in 'value' field of dataSet */
            if (!options.forceRunMode && !options.skipDataSetUpdate) {
                variable.dataSet = (!WM.isObject(response)) ? {'value': response} : response;
            }

            /* trigger success callback */
            Utils.triggerFn(success, response);

            $timeout(function () {
                // EVENT: ON_SUCCESS
                initiateCallback(VARIABLE_CONSTANTS.EVENT.SUCCESS, variable, response, options.xhrObj);

                if (CONSTANTS.isRunMode) {
                    /* process next requests in the queue */
                    variableActive[variable.activeScope.$id][variable.name] = false;
                    variable.canUpdate = true;
                    processRequestQueue(variable, requestQueue[variable.activeScope.$id], getDataInRun);
                }

                // EVENT: ON_CAN_UPDATE
                initiateCallback(VARIABLE_CONSTANTS.EVENT.CAN_UPDATE, variable, response, options.xhrObj);
            });
        }

        //Gets method info for given variable and input fields using options provided
        function getMethodInfo(variable, inputFields, options) {
            if(!variable._wmServiceOperationInfo) {
                return {};
            }
            var methodInfo = Utils.getClonedObject(variable._wmServiceOperationInfo),
                securityDefnObj = _.get(methodInfo.securityDefinitions, '0'),
                isOAuthTypeService = securityDefnObj && (securityDefnObj.type === VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_OAUTH2);
            if (methodInfo.parameters) {
                methodInfo.parameters.forEach(function (param) {
                    //Ignore readOnly params in case of formData file params will be duplicated
                    if (param.readOnly) {
                        return;
                    }
                    param.sampleValue = inputFields[param.name];
                    /* supporting pagination for query service variable */
                    if (VARIABLE_CONSTANTS.PAGINATION_PARAMS.indexOf(param.name) !== -1) {
                        if (param.name === "size") {
                            param.sampleValue = options.size || param.sampleValue || parseInt(variable.maxResults, 10);
                        } else if (param.name === "page") {
                            param.sampleValue = options.page || param.sampleValue;
                        } else if (param.name === "sort") {
                            param.sampleValue = Variables.getEvaluatedOrderBy(variable.orderBy, options.orderBy) || param.sampleValue;
                        }
                    } else if (param.name === "access_token" && isOAuthTypeService) {
                        param.sampleValue = oAuthProviderService.getAccessToken(securityDefnObj[OAUTH_PROVIDER_KEY]);
                    }
                });
            }
            return methodInfo;
        }

        /**
         * this function adds the inputParams of basic auth related
         * @param inputParams
         * @param inputFields
         */
        function addBasicAuthParams(inputParams, inputFields) {
            var username_param = {name: "wm_auth_username", parameterType: "auth", required: false, type: null, readOnly: false},
                pwd_param = {name: "wm_auth_password", parameterType: "auth", required: false, type: null, readOnly: false};

            username_param.sampleValue = inputFields[username_param.name];
            pwd_param.sampleValue = inputFields[pwd_param.name];

            inputParams = inputParams || [];

            inputParams.push(username_param);
            inputParams.push(pwd_param);
        }

        /**
         * function to get variable data in RUN Mode
         * @param variable
         * @param options
         * @param success
         * @param errorCB
         */
        function getDataInRun(variable, options, success, errorCB) {
            /* get the service and operation from the variable object */
            var service = variable.service,
                operation = variable.operation,
                serviceType = variable.serviceType,
                dataParams = [],
                params,
                methodInfo,
                inputFields = Utils.getClonedObject(options.inputFields || variable.dataBinding),
                output;

            // EVENT: ON_BEFORE_UPDATE
            if (CONSTANTS.isRunMode) {
                output = initiateCallback(VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE, variable, inputFields, options);
                if (output === false) {
                    Utils.triggerFn(errorCB);
                    return;
                }
                if (_.isObject(output)) {
                    inputFields = output;
                }
                $rootScope.$emit('toggle-variable-state', variable, !options.skipToggleState);
                variableActive[variable.activeScope.$id][variable.name] = true;
                variable.canUpdate = false;
            }

            /* loop over the parameters required for the variable and push them request dataParams */
            WM.forEach(inputFields, function (param) {
                dataParams.push(param);
            });

            if (REST_SUPPORTED_SERVICES.indexOf(serviceType) !== -1) {
                //If meta data for a service is not found, check if the user is authenticated or not
                //If user is athenticated then display a toaster stating he is not authorised
                //else redirect him to login dialog or login page based on project settings
                if (!variable._wmServiceOperationInfo) {
                    SecurityService.isAuthenticated(function (isAuthenticated) {
                        if (isAuthenticated) {
                            params = {
                                'error': {
                                    'type': 'meta_data_missing',
                                    'field': '_wmServiceOperationInfo',
                                    'message': 'You\'re not authorised to access the resource "' + variable.service + '".'
                                }
                            };
                        } else {
                            params =  {
                                'error' : {
                                    'type': 'meta_data_missing',
                                    'field': '_wmServiceOperationInfo',
                                    'message': 'You\'re not authenticated to access the resource "' + variable.service + '".',
                                    'skipDefaultNotification' : true
                                }
                            };
                            variableActive[variable.activeScope.$id][variable.name] = false;
                            BaseService.pushToErrorCallStack(null, variable.invoke.bind(variable, options, success, errorCB), WM.noop);
                            var appManager = Utils.getService("AppManager");
                            appManager.handleSessionTimeOut();
                        }
                    }, function (authenticationError) {
                        console.warn(authenticationError);
                    });
                } else {
                    methodInfo = getMethodInfo(variable, inputFields, options);
                    /*Adding basic auth params via script should be removed once the backend gives a fix*/
                    if (_.get(methodInfo.securityDefinitions, '0.type') === VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_BASIC) {
                        addBasicAuthParams(methodInfo.parameters, inputFields);
                    }
                    if (_.isEmpty(methodInfo)) {
                        params = {
                            'error': {
                                'type': 'meta_data_missing',
                                'field': '_wmServiceOperationInfo',
                                'message': 'Meta data for the service "' + variable.service + '" is missing. Please run the project again.'
                            }
                        };
                    } else {
                        params = constructRestRequestParams(methodInfo, variable, inputFields);
                    }
                }
                if (params.error && params.error.type === ERR_TYPE_NO_ACCESSTOKEN) {
                    oAuthProviderService.performAuthorization(undefined, params.securityDefnObj[OAUTH_PROVIDER_KEY], getDataInRun.bind(undefined, variable, options, success, errorCB));
                    processErrorResponse(variable, params.error.message, errorCB, options.xhrObj, true, true);
                    return;
                }
                if (params.error && params.error.message) {
                    console.warn(params.error.message + ": " + variable.name);
                    processErrorResponse(variable, params.error.message, errorCB, options.xhrObj, options.skipNotification, params.error.skipDefaultNotification);
                    return;
                }
            } else if (serviceType === SERVICE_TYPE_REST) {
                dataParams = [service, operation, Utils.getClonedObject(inputFields)];

                /*prepare request params*/
                params = {
                    "method": REST_METHOD_NAME,
                    "params": dataParams,
                    "url": $rootScope.project.deployedUrl,
                    "target": "invokeRestService"
                };
            } else {
                /*for old projects as a normal java method invocation*/
                params = {
                    "method": operation,
                    "serviceFile": service + ".json",
                    "params": dataParams,
                    "url": $rootScope.project.deployedUrl
                };
            }

            if (variable._prefabName && REST_SUPPORTED_SERVICES.indexOf(serviceType) === -1) {
                /* if it is a prefab variable (used in a normal project), modify the url */
                params.url += "/prefabs/" + variable._prefabName;
                params.target = "invokePrefabRestService";
            }

            /* if the service produces octet/stream, replicate file download through form submit */
            if (methodInfo && WM.isArray(methodInfo.produces) && _.includes(methodInfo.produces, WS_CONSTANTS.CONTENT_TYPES.OCTET_STREAM)) {
                Utils.simulateFileDownload(params, variable.dataBinding.file || variable.name, variable.dataBinding.exportType, function () {
                    initiateCallback(VARIABLE_CONSTANTS.EVENT.SUCCESS, variable);
                    Utils.triggerFn(success);
                }, function () {
                    initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, variable);
                    Utils.triggerFn(errorCB);
                });
                variableActive[variable.activeScope.$id][variable.name] = false;
                return;
            }

            if (REST_SUPPORTED_SERVICES.indexOf(serviceType) !== -1 && variable._wmServiceOperationInfo) {
                /* Here we are invoking JavaService through the new REST api (old classes implementation removed, older projects migrated with new changes for corresponding service variable) */
                variable.promise = WebService.invokeJavaService(params, function (response, xhrObj) {
                    if (_.get(xhrObj, 'status') === WS_CONSTANTS.HTTP_STATUS_CODE.CORS_FAILURE) {
                        processErrorResponse(variable, WS_CONSTANTS.HTTP_STATUS_CODE_MESSAGES[WS_CONSTANTS.HTTP_STATUS_CODE.CORS_FAILURE], errorCB, xhrObj, options.skipNotification);
                    } else {
                        options.xhrObj = xhrObj;
                        processSuccessResponse(response, variable, options, success);
                    }
                }, function (errorMsg, details, xhrObj) {
                    if (_.get(details, 'status') === WS_CONSTANTS.HTTP_STATUS_CODE.CORS_FAILURE) {
                        if (navigator.onLine) {
                            errorMsg = WS_CONSTANTS.HTTP_STATUS_CODE_MESSAGES[WS_CONSTANTS.HTTP_STATUS_CODE.CORS_FAILURE];
                        } else {
                            errorMsg = $rootScope.appLocale["MESSAGE_NETWORK_NOT_AVAILABLE"];
                        }
                    }
                    processErrorResponse(variable, errorMsg, errorCB, xhrObj, options.skipNotification);
                });
            }
        }

        /**
         * function to get variable data in Studio mode
         * @param variable
         * @param startNode
         * @param success
         */
        function getDataInStudio(variable, startNode, success) {
            /* get the service and operation from the variable object */
            var service = variable.service,
                operationId = variable.operationId,
                serviceModel = {};

            /* get the data from variable return type information */
            ServiceFactory.getServicesWithType(function () {
                ServiceFactory.getServiceOperations(service, function () {
                    ServiceFactory.getServiceOperationParams(service, operationId, function (response) {
                        var typeRef = _.get(response, ['return', 'typeRef']),
                            fieldValue = startNode ? startNode.substring(variable.name.length + 1, startNode.length) : startNode,
                            variableTypeNode,
                            transformationCols;
                        serviceModel = {};

                        variable.type = variable.type || typeRef;
                        variable.isList = response.isList;
                        variable._format = response.returnFormat;
                        /* prepare sample data-structure for the service */
                        prepareServiceModel(variable.type, serviceModel, fieldValue, variable);

                        /*
                         * check for transformation columns in variable
                         * if found, push a new type node for 'wmTransformedData' in the dataTypes with the transformationColumns
                         */
                        if (variable.transformationColumns) {
                            serviceModel['wmTransformedData'] = {};
                            WM.forEach(variable.transformationColumns, function (columnName) {
                                serviceModel['wmTransformedData'][columnName] = '';
                            });
                            variableTypeNode = $rootScope.dataTypes[variable.type];
                            transformationCols = variable.transformationColumns;
                            variableTypeNode.fields['wmTransformedData'] = {'type': variable.service + '.wmTransformedData'};
                            $rootScope.dataTypes[variable.service + '.wmTransformedData'] = {
                                'service': variable.service,
                                'fields': _.zipObject(transformationCols, _.fill(new Array(transformationCols.length), {'type': 'string, number, date, datetime'}))
                            };
                        }

                        /* update the dataset */
                        variable.dataSet = variable.isList ? [serviceModel] : serviceModel;
                        /*pass the data prepared to the success callback function*/
                        Utils.triggerFn(success, serviceModel);
                    });
                });
            });
        }

        /**
         * function to create the service operation info in the variable object, to create the parameter info
         * for the selected operation of the service
         * @param selectedOperation
         * @param selectedService
         * @param success
         * @param error
         * @param forceReload
         * @param controller
         */
        function getServiceOperationInfo(selectedOperation, selectedService, success, error, forceReload, controller) {
            var operationInfo = {};

            /*invoking a service to get the operations that a particular service has and it's
             * parameters to create a unique url pattern*/
            ServiceFactory.getServiceDef(selectedService, function (response) {
                /*iterate over the paths received from the service response*/
                var pathsArr = Object.keys(response.paths),
                    securityDefinitions = response.securityDefinitions,
                    AUTH_BASIC_TYPE = VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_BASIC,
                    paramDataType,
                    i,
                    nPaths,
                    pathKey,
                    path,
                    j,
                    nOps,
                    opType,
                    operation;
                for (i = 0, nPaths = pathsArr.length; i < nPaths; i++) {
                    pathKey = pathsArr[i];
                    path = response.paths[pathKey];
                    for (j = 0, nOps = supportedOperations.length; j < nOps; j++) {
                        opType = supportedOperations[j];
                        operation = path[opType];
                        if (operation && operation[WS_CONSTANTS.OPERATION_NAME_KEY] === selectedOperation) {
                            /* if controller is provided, check for controller match as well */
                            if (controller && controller + "Controller" !== path[CONTROLLER_KEY]) {
                                continue;
                            }
                            operationInfo.httpMethod = opType;
                            operationInfo.operationId = operation.operationId;
                            operationInfo.name = selectedOperation;
                            operationInfo.relativePath = (path[BASE_PATH_KEY] || "") + path[RELATIVE_PATH_KEY];
                            /*saving the request mime type only if it is explicitly mentioned used in the file upload widget to decide the mime type from swagger path object*/
                            if (operation.consumes && operation.consumes.length) {
                                operationInfo.consumes = operation.consumes;
                            }
                            /*
                             * saving the response mime type only if it is explicitly mentioned.
                             * UseCase: 'download' operation of 'FileService' gives application/octet-stream
                             * this is used to determine if a download file has to be simulated through form submit(as download not possible through AJAX)
                             */
                            if (operation.produces && operation.produces.length) {
                                operationInfo.produces = operation.produces;
                            }
                            operationInfo.parameters = [];

                            if (operation.parameters && operation.parameters.length) {
                                operation.parameters.forEach(function (parameter) {
                                    if (parameter[parameterTypeKey].toLowerCase() === 'formdata') {
                                        paramDataType = parameter.type === "array" ? (parameter.items && parameter.items.type) || parameter.type : parameter.type;
                                    } else {
                                        paramDataType = parameter.type;
                                    }
                                    operationInfo.parameters.push({
                                        "name": parameter.name || (parameter[parameterTypeKey] && parameter[parameterTypeKey].toLowerCase()),
                                        "parameterType": parameter[parameterTypeKey],
                                        "type": paramDataType
                                    });
                                });
                            }
                            if (securityDefinitions && securityDefinitions[AUTH_BASIC_TYPE] && securityDefinitions[AUTH_BASIC_TYPE].type === VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN_BASIC && operation.security[0][AUTH_BASIC_TYPE]) {
                                operationInfo.authorization = securityDefinitions[AUTH_BASIC_TYPE].type;
                                operationInfo.parameters.push({
                                    "name": "wm_auth_username",
                                    "parameterType": "auth"
                                });
                                operationInfo.parameters.push({
                                    "name": "wm_auth_password",
                                    "parameterType": "auth"
                                });
                            }
                            break;
                        }
                    }
                    if (j < nOps) {
                        break;
                    }
                }
                /*pass the data prepared to the success callback function*/
                Utils.triggerFn(success, operationInfo);
            }, function (errMsg) {
                /*handle error response*/
                Utils.triggerFn(error, errMsg);
            }, forceReload);
        }
        //Function to get operationId for the operation
        function getOperationId(selectedOperation, selectedService, success, error, forceReload) {
            var operationId;
            ServiceFactory.getServiceDef(selectedService, function (response) {
                _.forEach(response.paths, function (path) {
                    _.forEach(supportedOperations, function (op) {
                        if (_.get(path, [op, WS_CONSTANTS.OPERATION_NAME_KEY]) === selectedOperation) {
                            operationId = _.get(path, [op, 'operationId']);
                        }
                        return !operationId;
                    });
                    return !operationId;
                });
                Utils.triggerFn(success, operationId);
            }, function (errMsg) {
                /*handle error response*/
                Utils.triggerFn(error, errMsg);
            }, forceReload);
        }
        function update(options, success, error) {
            var variable = this;
            options = options || {};
            options.scope = this.activeScope || options.scope;
            methods.getData(this, options, function (response) {
                if (CONSTANTS.isRunMode) {
                    $rootScope.$emit('toggle-variable-state', variable, false, response);
                }
                Utils.triggerFn(success, response);
            }, function (errMsg) {
                if (CONSTANTS.isRunMode) {
                    $rootScope.$emit('toggle-variable-state', variable, false);
                }
                Utils.triggerFn(error, errMsg);
            });
        }

        /* properties of a service variable - should contain methods applicable on this particular object */
        methods = {
            getDataSet: function (variable) {
                /* return the variable dataSet*/
                return variable.dataSet;
            },
            getData: function (variable, options, success, error) {
                /* get the variable object from variable collection */
                var variableName = variable.name,
                    startNode = options.startNode,
                    serviceModel;

                /* if variable not found return into error callback */
                if (Utils.isEmptyObject(variable)) {
                    error();
                    return;
                }

                /* if in run mode, hit the web service and retrieve data */
                if (CONSTANTS.isRunMode || options.forceRunMode) {
                    if (CONSTANTS.isRunMode) {
                        variableActive[variable.activeScope.$id] = variableActive[variable.activeScope.$id] || {};
                        requestQueue[variable.activeScope.$id] = requestQueue[variable.activeScope.$id] || {};
                        if (variableActive[variable.activeScope.$id][variableName]) {
                            options.inputFields = options.inputFields || Utils.getClonedObject(variable.dataBinding);
                            requestQueue[variable.activeScope.$id][variableName] = requestQueue[variable.activeScope.$id][variableName] || [];
                            requestQueue[variable.activeScope.$id][variableName].push({variable: variable, options: options, success: success, error: error});
                            return;
                        }
                    }
                    if (options.forceRunMode) {
                        /*call run-project service*/
                        ProjectService.run({
                            projectId: $rootScope.project.id
                        }, function (result) {
                            /*Save the deployed url of the project in the $rootScope so that it could be used in all calls to services of deployed app*/
                            $rootScope.project.deployedUrl = Utils.removeProtocol(result);
                            getDataInRun(variable, options, success, error);
                        });
                    } else {
                        getDataInRun(variable, options, success, error);
                    }
                } else if (variable._prefabName) {
                    serviceModel = {};
                    ServiceFactory.getPrefabTypes(variable._prefabName, function (types) {
                        prefabDataTypes[variable._prefabName] = types;
                        /* prepare sample data-structure for the service */
                        prepareServiceModel(variable.type, serviceModel, null, variable);
                        variable.dataSet = serviceModel;
                        Utils.triggerFn(success, serviceModel);
                    });
                }
            },
            setService: function (variable, service) {
                if (service) {
                    variable.service = service;
                }

                return variable.service;
            },
            setOperation: function (variable, operation) {
                if (operation) {
                    variable.operation = operation;
                }

                return variable.operation;
            },
            clearData: function (variable) {
                variable.dataSet = {};

                /* return the variable dataSet*/
                return variable.dataSet;
            },
            cancel: function (variable) {
                /* process only if current variable is actually active */
                if (variableActive[variable.activeScope.$id][variable.name] && variable.promise) {
                    variable.promise.abort();
                }
            },
            setInput: function (variable, key, val, options) {
                var targetObj = variable.dataBinding,
                    keys,
                    lastKey,
                    paramObj = {};
                if (WM.isObject(options)) {
                    switch (options.type) {
                    case 'file':
                        val = Utils.getBlob(val, options.contentType);
                        break;
                    case 'number':
                        val = _.isNumber(val) ? val : parseInt(val, 10);
                        break;
                    }
                }
                if (WM.isObject(key)) {
                    paramObj = key;
                } else if (key.indexOf('.') > -1) {
                    keys = key.split('.');
                    lastKey = keys.pop();
                    /*Finding the object based on the key*/
                    targetObj = Utils.findValueOf(targetObj, keys.join('.'), true);
                    key = lastKey;
                    paramObj[key] = val;
                } else {
                    paramObj[key] = val;
                }

                WM.forEach(paramObj, function (paramVal, paramKey) {
                    targetObj[paramKey] = paramVal;
                });
                return variable.dataBinding;
            }
        };
        serviceVariableObj = {
            update: update,
            invoke : update,
            setService: function (service) {
                return methods.setService(this, service);
            },
            setOperation: function (operation) {
                return methods.setOperation(this, operation);
            },
            getData: function () {
                return methods.getDataSet(this);
            },
            clearData: function () {
                return methods.clearData(this);
            },
            cancel: function () {
                return methods.cancel(this);
            },
            setInput: function (key, val, options) {
                return methods.setInput(this, key, val, options);
            },
            download: function (options, successHandler, errorHandler) {
                options = options || {};
                var inputParams  = Utils.getClonedObject(this.dataBinding),
                    methodInfo   = getMethodInfo(this, inputParams, options),
                    requestParams,
                    inputData = options.data || {};

                methodInfo.relativePath += '/export';
                requestParams = constructRestRequestParams(methodInfo, this);

                requestParams.dataParams = inputData;
                requestParams.dataParams.fields = Utils.formatExportExpression(inputData.fields || []);

                // extra options provided, these may be used in future for integrating export feature with ext. services
                requestParams.method = options.httpMethod || 'POST';
                requestParams.url = options.url || requestParams.url;

                //If request params returns error then show an error toaster
                if (_.hasIn(requestParams, 'error.message')) {
                    Utils.triggerFn(errorHandler, requestParams.error.message);
                } else {
                    WebService.invokeJavaService(requestParams, function (response) {
                        if(response && Utils.isValidWebURL(response.result)) {
                            window.location.href = response.result;
                            Utils.triggerFn(successHandler, response);
                        } else {
                            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, this, response);
                            Utils.triggerFn(errorHandler, response);
                        }
                    }, function (response, xhrObj) {
                        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, this, response, xhrObj);
                        Utils.triggerFn(errorHandler, response);
                    });
                }
            },
            init: function () {
                if (this.isList) {
                    Object.defineProperty(this, 'firstRecord', {
                        'configurable': true,
                        'get': function () {
                            var dataSet = methods.getDataSet(this);
                            //For procedure(v1) data doesn't come under content
                            return _.head(dataSet && dataSet.content) || _.head(dataSet) || {};
                        }
                    });
                    Object.defineProperty(this, 'lastRecord', {
                        'configurable': true,
                        'get': function () {
                            var dataSet = methods.getDataSet(this);
                            //For procedure(v1) data doesn't come under content
                            return _.last(dataSet && dataSet.content) || _.last(dataSet) || {};
                        }
                    });
                }
            }
        };

        /* register the variable to the base service */
        BaseVariablePropertyFactory.register('wm.ServiceVariable', serviceVariableObj, ['wm.Variable'], methods);

        return {
            getServiceModel           : function (params) {
                var model = {},
                    variable = params.variable || {},
                    prefabName = _.get(variable, '_prefabName');
                if (prefabName) {
                    prefabDataTypes[prefabName] = params.types;
                }
                prepareServiceModel(params.typeRef, model, null, variable);

                return model;
            },
            getServiceOperationInfo   : getServiceOperationInfo,
            getOperationId            : getOperationId,
            constructRestRequestParams: constructRestRequestParams
        };
    }];
