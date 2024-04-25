/*global WM, window, document, _, wm*/
/*Directive for liveform */

WM.module('wm.widgets.live')
    /*Define controller for the liveform in dialog mode - required*/
    .controller('liveFormDialogController', WM.noop)
    .directive('wmLiveform', ['PropertiesFactory', 'WidgetUtilService', '$compile', '$rootScope', 'CONSTANTS', '$controller', 'Utils', 'wmToaster', '$filter', 'LiveWidgetUtils', 'DialogService', function (PropertiesFactory, WidgetUtilService, $compile, $rootScope, CONSTANTS, $controller, Utils, wmToaster, $filter, LiveWidgetUtils, DialogService) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.layouts.liveform', ['wm.base', 'wm.base.events.successerror', 'wm.layouts.panel.defaults']),
            notifyFor = {
                'dataset'         : true,
                'novalidate'      : true,
                'validationtype'  : true,
                'autocomplete'    : true,
                'rowdata'         : true,
                'formdata'        : true,
                'updatemode'      : true,
                'formlayout'      : true,
                'formtype'        : true,
                'defaultmode'     : true,
                'captionalign'    : true,
                'captionposition' : true,
                'captionwidth'    : true
            },
            /*check if the field is of column type time or widget type time*/
            isTimeType = function (field) {
                return field.widget === 'time' || (field.type === 'time' && !field.widget);
            },
            /*Convert time value to a valid date time value*/
            getValidTime = function (val) {
                if (val) {
                    var date = (new Date()).toDateString();
                    return (new Date(date + ' ' + val)).getTime();
                }
                return undefined;
            },
            pageTemplate,
            defaultTemplate;

        return {
            restrict: 'E',
            replace: true,
            scope: {
                //"onSuccess": "&",
                //"onError": "&",
                "onBeforeservicecall": "&",
                "onResult": "&"
            },
            require: '?^wmLivetable',
            template: function (template, attrs) {
                /*render the template with mobile-navbar if formlayout is page*/

                var expr = (attrs.onBackbtnclick ? ('on-backbtnclick="' + attrs.onBackbtnclick + '"') : '');

                pageTemplate = '<form data-identifier="liveform" init-widget role="form" class="app-device-liveform panel liveform-inline" ng-class="[captionAlignClass]" ng-submit="formSave($event);" apply-styles="shell">' +
                                '<wm-mobile-navbar title="{{title}}" ' + expr + '>' +
                                    '<wm-button type="{{btn.type}}" class="navbar-btn btn-primary btn-transparent" ng-repeat="btn in buttonArray" caption="" title="{{btn.displayName}}" iconclass="{{btn.iconclass}}" margin="unset 0" show="{{isUpdateMode && btn.show}}" on-click="{{btn.action}}"></wm-button>' +
                                '</wm-mobile-navbar>' +
                                '<div ng-show="isLayoutDialog" class="text-left"><i class="wi wi-gear app-dialogmode-icon"></i><span class="app-dialogmode-text">Live form in dialog mode</span></div>' +
                                '<div class="form-elements panel-body" ng-class="{\'update-mode\': isUpdateMode }" ng-show="!isLayoutDialog" apply-styles="inner-shell">' +
                                    template.context.innerHTML +
                                '</div>' +
                        '</form>';

                defaultTemplate = '<form data-identifier="liveform" init-widget role="form" class="app-liveform panel app-panel liveform-inline" ng-class="[captionAlignClass]" ng-submit="formSave($event);" apply-styles="shell" captionposition="{{captionposition}}">' +
                                    '<div ng-show="isLayoutDialog" class="text-left"><i class="wi wi-gear app-dialogmode-icon"></i><span class="app-dialogmode-text">Live form in dialog mode</span></div>' +
                                    '<div class="panel-heading" ng-show="!isLayoutDialog && (title || subheading || iconclass || showButtons(\'header\'))">' +
                                        '<h3 class="panel-title">' +
                                            '<div class="pull-left"><i class="app-icon panel-icon {{iconclass}}" ng-show="iconclass"></i></div>' +
                                            '<div class="pull-left">' +
                                                '<div class="heading">{{title}}</div>' +
                                                '<div class="description">{{subheading}}</div>' +
                                            '</div>' +
                                            '<div class="form-action panel-actions basic-btn-grp">' +
                                            '</div>' +
                                        '</h3>' +
                                    '</div>' +
                                    '<div class="form-elements panel-body" ng-class="{\'update-mode\': isUpdateMode }" ng-show="!isLayoutDialog" apply-styles="inner-shell">' +
                                        '<wm-message ng-if=(messagelayout==="Inline") scopedataset="statusMessage" hideclose="false"></wm-message>' +
                                        template.context.innerHTML +
                                    '</div>' +
                                    '<div class="basic-btn-grp form-action panel-footer clearfix" ng-show="!isLayoutDialog && showButtons(\'footer\')"></div>' +
                                '</form>';

                if (CONSTANTS.isRunMode && (attrs.formtype === 'dialog' || attrs.layout === 'dialog' || attrs.formlayout === 'dialog')) {
                    /*Generate a unique id for the dialog to avoid conflict with multiple dialogs.*/
                    attrs.dialogid = 'liveformdialog-' + attrs.name + '-' + Utils.generateGUId();
                    return '<div data-identifier="liveform" init-widget class="app-liveform liveform-dialog" >' +
                                '<wm-dialog class="app-liveform-dialog" width="{{dialogWidth}}" contentclass="noscroll" iconclass="{{iconclass}}" name="' + attrs.dialogid + '" title="{{title}}" modal="true" controller="liveFormDialogController">' +
                                    '<form data-identifier="liveform" role="form" name="' + attrs.name + '" class="app-liveform" autocomplete="' + ((attrs.autocomplete === 'true' || attrs.autocomplete === true) ? 'on' : 'off') + '" ng-submit="formSave($event);" apply-styles="shell" ng-class="[captionAlignClass]"' +
                                        ' live-form-with-dialog>' +
                                        '<div class="form-elements panel-body" ng-class="{\'update-mode\': isUpdateMode }" ng-style="{height: height, overflow: height ? \'auto\': overflow, padding: padding}">' +
                                            '<wm-message ng-if=(messagelayout==="Inline") scopedataset="statusMessage" hideclose="false"></wm-message>' +
                                            '<div class="form-content">' + template.context.innerHTML + '</div>' +
                                        '</div>' +
                                        '<div class="basic-btn-grp form-action modal-footer clearfix panel-footer">' +
                                            '<div class="action-content"></div>' +
                                        '</div>' +
                                    '</form>' +
                                '</wm-dialog>' +
                            '</div>';
                }
                if (attrs.formlayout === 'page') {
                    return pageTemplate;
                }
                return defaultTemplate;
            },
            controller: function ($scope, $attrs, DialogService) {
                var prevformFields,
                    prevDataObject = {},
                    formController,
                    onResult,
                    onVariableUpdate;
                //Function to get the form element
                function getFormElement() {
                    if ($scope.isLayoutDialog) {
                        return WM.element('body').find('.app-liveform-dialog[dialogid="' + $scope._dialogid + '"]');
                    }
                    return $scope.element;
                }
                //Reset form state
                function resetFormState() {
                    var $formEle     = getFormElement(),
                        formScope    = $scope.isLayoutDialog && $formEle.length ? $formEle.scope() : $scope;
                    if (!formScope.ngform) {
                        return;
                    }
                    //Reset the form to original state on cancel/ save
                    formScope.ngform.$setUntouched();
                    formScope.ngform.$setPristine();
                }

                // Reset the search widget only when there is no default datavalue.
                function resetSearch($el) {
                    if ($el.hasClass('app-search')) {
                        var $is = $el.isolateScope();

                        $is.defaultQuery = $el.attr('scopedatavalue') || $el.attr('datavalue');
                        return WM.isUndefined($is.datavalue) && $is.query && $is.queryModel;
                    }
                    return false;
                }

                //Reset the values of widgets inside the form
                function resetFormFields(formEle) {
                    formEle.find('[role="input"]').each(function () {
                        var $inputEl = WM.element(this);
                        //Reset the widgets other than form fields
                        if (_.isEmpty($inputEl.closest('[data-role="form-field"]')) || resetSearch($inputEl)) {
                            WM.element(this).isolateScope().reset();
                        }
                    });
                }
                /*
                 * Extend the properties from the form controller exposed to end user in page script
                 * Kept in try/catch as the controller may not be available sometimes
                 */
                if (CONSTANTS.isRunMode) {
                    try {
                        formController = $attrs.name + "Controller";
                        $controller(formController, {$scope: $scope});
                    } catch (ignore) {
                    }
                }
                $scope.__compileWithIScope = true;
                /* when the service call ended this function will be called */
                /* prevformFields is used for showing the previous data when cancel is clicked and also for update calls*/
                onResult = function (data, status, event) {
                    /* whether service call success or failure call this method*/
                    $scope.onResult({$event: event, $operation: $scope.operationType, $data: data});
                    if (status) {
                        /*if service call is success call this method */
                        Utils.triggerFn($scope.onSuccess, {$event: event, $operation: $scope.operationType, $data: data});
                    } else {
                        /* if service call fails call this method */
                        Utils.triggerFn($scope.onError, {$event: event, $operation: $scope.operationType, $data: data});
                    }

                };
                onVariableUpdate = function (response, newForm, updateMode) {
                    if (newForm) {
                        $scope.new();
                    } else {
                        $scope.changeDataObject(response);
                    }
                    $scope.isUpdateMode = WM.isDefined(updateMode) ? updateMode : true;
                };
                $scope.prevDataValues = [];
                $scope.findOperationType = function (variable) {
                    var operation,
                        isPrimary = false;
                    if (variable && variable.operation && variable.operation !== 'read') {
                        return variable.operation;
                    }
                    /*If OperationType is not set then based on the formdata object return the operation type,
                        this case occurs only if the form is outside a livegrid*/
                    /*If the formdata object has primary key value then return update else insert*/
                    if ($scope.primaryKey && $scope.formdata) {
                        /*If only one column is primary key*/
                        if ($scope.primaryKey.length === 1) {
                            if ($scope.formdata[$scope.primaryKey[0]]) {
                                operation = 'update';
                            }
                        /*If only no column is primary key*/
                        } else if ($scope.primaryKey.length === 0) {
                            _.forEach($scope.formdata, function (value) {
                                if (value) {
                                    isPrimary = true;
                                }
                            });
                            if (isPrimary) {
                                operation = 'update';
                            }
                        /*If multiple columns are primary key*/
                        } else {
                            isPrimary = _.some($scope.primaryKey, function (primarykey) {
                                if ($scope.formdata[primarykey]) {
                                    return true;
                                }
                            });
                            if (isPrimary) {
                                operation = 'update';
                            }
                        }
                    }
                    return operation || 'insert';
                };
                /*Call respective functions for save and cancel*/
                $scope.save = function () {
                    $scope.formSave(undefined, true);
                };

                /*Function use to save the form and open new form after save*/
                $scope.saveAndNew = function () {
                    $scope.formSave(undefined, true, true);
                };
                /*Function use to save the form and open new form after save*/
                $scope.saveAndView = function () {
                    $scope.formSave(undefined, false);
                };
                /*Function to show the message on top of the dialog or to display the toaster
                 * type can be error or success*/
                $scope.toggleMessage = function (show, msg, type, header) {
                    var template;
                    if (show && msg) {
                        if ($scope.messagelayout === 'Inline') {
                            template = (type === 'error' && $scope.errormessage) ? $scope.errormessage : msg;
                            $scope.statusMessage = {'caption': template || '', type: type};
                        } else {
                            template = (type === 'error' && $scope.errormessage) ? $scope.errormessage : msg;
                            wmToaster.show(type, WM.isDefined(header) ? header : type.toUpperCase(), template, undefined, 'trustedHtml');
                        }
                    } else {
                        $scope.statusMessage = null;
                    }
                };
                /*Method to handle the insert, update, delete actions*/
                /*The operationType decides the type of action*/
                $scope.formSave = function (event, updateMode, newForm, callBackFn) {
                    var data,
                        prevData,
                        requestData  = {},
                        elScope      = $scope.element.scope(),
                        variableName = $scope.variableName || Utils.getVariableName($scope),
                        variable     = elScope.Variables[variableName],
                        $formEle     = getFormElement(),
                        formScope    = $scope.isLayoutDialog && $formEle.length ? $formEle.scope() : $scope,
                        isValid,
                        deleteFn;
                    $scope.operationType = $scope.operationType || $scope.findOperationType(variable);

                    //Disable the form submit if form is in invalid state. For delete operation, do not check the validation.
                    if (LiveWidgetUtils.validateFieldsOnSubmit($scope, formScope.ngform, $formEle)) {
                        return;
                    }

                    /*If live-form is in a dialog, then always fetch the formElement by name
                    because the earlier reference "$scope.formElement" would be destroyed on close of the dialog.*/
                    $scope.formElement = $scope.isLayoutDialog ? (document.forms[$scope.name]) : ($scope.formElement || document.forms[$scope.name]);

                    /*Construct the data object with required values from the formFields*/
                    /*If it is an update call send isUpdate true for constructDataObject so the dataObject is
                    constructed out of the previous object*/
                    data = $scope.constructDataObject();
                    prevData = prevformFields ? $scope.constructDataObject(true) : data;
                    try {
                        isValid = $scope.onBeforeservicecall({$event: event, $operation: $scope.operationType, $data: data, options: requestData});
                        if (isValid === false) {
                            return;
                        }
                        if (isValid && isValid.error) {
                            wmToaster.show('error', 'ERROR', isValid.error);
                            return;
                        }
                    } catch (err) {
                        if (err.message === "Abort") {
                            return;
                        }
                    }

                    //If operation is update, form is not touched and current data and previous data is same, Show no changes detected message
                    if ($scope.operationType === 'update' && formScope.ngform && formScope.ngform.$pristine && ($scope.isSelected && _.isEqual(data, prevData))) {
                        $scope.toggleMessage(true, $scope.appLocale.MESSAGE_NO_CHANGES, 'info', '');
                        return;
                    }

                    resetFormState();

                    requestData.row = data;
                    requestData.transform = true;
                    requestData.multipartData = $scope.multipartData
                    requestData.skipNotification = true
                    /*Pass in the prefab scope if the liveForm is present in a prefab, as the bound variable is available in the prefab scope only*/
                    if (elScope.prefabname) {
                        requestData.scope = elScope;
                    }
                    /*Based on the operationType decide the action*/
                    switch ($scope.operationType) {
                    case "update":
                        requestData.rowData = $scope.rowdata || $scope.formdata;
                        requestData.prevData = prevData;
                        if ($scope.subscribedWidget) {
                            $scope.subscribedWidget.call("update", requestData, function (response) {
                                if ($scope.isLayoutDialog) {
                                    DialogService.hideDialog($scope._dialogid);
                                }
                                $scope.isUpdateMode = false;
                                onResult(response, true, event);
                                $scope.toggleMessage(true, $scope.updatemessage, 'success');
                            }, function (error) {
                                onResult(error, false, event);
                                $scope.toggleMessage(true, $scope.errormessage || error, 'error');
                            });
                        } else {
                            variable.updateRecord(requestData, function (response) {
                                /*Display appropriate error message in case of error.*/
                                if (response.error) {
                                    onResult(response, false, event);
                                    /*disable readonly and show the appropriate error*/
                                    $scope.toggleMessage(true, response.error, 'error');
                                } else {
                                    onResult(response, true, event);
                                    $scope.toggleMessage(true, $scope.updatemessage, 'success');
                                    if ($scope.ctrl) {
                                        /* highlight the current updated row */
                                        $scope.$emit("on-result", "update", response, newForm, updateMode);
                                    } else {
                                        /*get updated data without refreshing page*/
                                        variable.update({
                                            'skipToggleState': true
                                        });
                                        onVariableUpdate(response, newForm, updateMode);
                                    }
                                }
                            }, function (error) {
                                onResult(error, false, event);
                                $scope.toggleMessage(true, error, 'error');
                            });
                        }
                        break;
                    case "insert":
                        if ($scope.subscribedWidget) {
                            $scope.subscribedWidget.call("create", requestData, function (response) {
                                if ($scope.isLayoutDialog) {
                                    DialogService.hideDialog($scope._dialogid);
                                }
                                $scope.isUpdateMode = false;
                                onResult(response, true, event);
                                $scope.toggleMessage(true, $scope.insertmessage, 'success');
                            }, function (error) {
                                onResult(error, false, event);
                                $scope.toggleMessage(true, $scope.errormessage || error, 'error');
                            });
                        } else {
                            variable.insertRecord(requestData, function (response) {
                                /*Display appropriate error message in case of error.*/
                                if (response.error) {
                                    onResult(response, false, event);
                                    $scope.toggleMessage(true, response.error, 'error');
                                } else {
                                    onResult(response, true, event);
                                    $scope.toggleMessage(true, $scope.insertmessage, 'success');
                                    /* if successfully inserted  change editable mode to false */
                                    if ($scope.ctrl) {
                                        /* highlight the current updated row */
                                        $scope.$emit("on-result", "insert", response, newForm, updateMode);
                                    } else {
                                        /*get updated data without refreshing page*/
                                        variable.update({
                                            'skipToggleState': true
                                        });
                                        onVariableUpdate(response, newForm, updateMode);
                                    }
                                }
                            }, function (error) {
                                onResult(error, false, event);
                                $scope.toggleMessage(true, error, 'error');
                            });
                        }
                        break;
                    case "delete":
                        deleteFn = function () {
                            variable.deleteRecord(requestData, function (success) {
                                /* check the response whether the data successfully deleted or not , if any error occurred show the
                                 * corresponding error , other wise remove the row from grid */
                                if (success && success.error) {
                                    onResult(success, false);
                                    $scope.toggleMessage(true, success.error, 'error');
                                    return;
                                }
                                onResult(requestData.row, true);
                                $scope.clearData();
                                $scope.prevDataValues = [];
                                $scope.toggleMessage(true, $scope.deletemessage, 'success');
                                $scope.isSelected = false;
                                /*get updated data without refreshing page*/
                                if ($scope.ctrl) {
                                    $scope.$emit('on-result', 'delete', success);
                                } else {
                                    variable.update({
                                        'skipToggleState': true
                                    });
                                }

                            }, function (error) {
                                onResult(error, false);
                                $scope.toggleMessage(true, error, 'error');
                                Utils.triggerFn(callBackFn);
                            });
                        };
                        $scope.toggleMessage(false);
                        if ($scope.ctrl) {
                            $scope.ctrl.confirmMessage(deleteFn, callBackFn);
                        } else {
                            deleteFn();
                        }
                        break;
                    }
                };
                /*Function to set the previous data array to be used while updating records in a live-form.*/
                $scope.setPrevformFields = function (formFields) {
                    prevformFields = Utils.getClonedObject(formFields);
                    prevDataObject = Utils.getClonedObject($scope.rowdata || {});
                };
                /*Method to clear the fields and set the form to readonly*/
                $scope.formCancel = function () {
                    $scope.reset();
                    $scope.toggleMessage(false);
                    /*Show the previous selected data*/
                    if ($scope.isSelected) {
                        $scope.formFields = $scope.formFields || Utils.getClonedObject(prevformFields);
                    }
                    $scope.$emit("on-cancel");
                    $scope.isUpdateMode = false;
                    if ($scope.isLayoutDialog) {
                        DialogService.hideDialog($scope._dialogid);
                    }
                };
                /*clear the formFields*/
                /*Method to save the previous data values. This will be used on form reset*/
                $scope.setPrevDataValues = function () {
                    if (!$scope.formFields || $scope.widgetid) {
                        return;
                    }
                    $scope.prevDataValues = $scope.formFields.map(function (obj) {
                        return {'key': obj.key, 'value': obj.value};
                    });
                };
                /*clear the file uploader widget for reset*/
                function resetFileUploadWidget(dataValue, skipValueSet) {
                    var $formEle = getFormElement();
                    $formEle.find('[name="' + dataValue.key + '_formWidget"]').val('');
                    if (!skipValueSet) {
                        dataValue.href = '';
                        dataValue.value = null;
                    }
                }
                /*clear the inline message*/
                $scope.clearMessage = function () {
                    $scope.toggleMessage(false);
                };
                /*Method to reset the form to original state*/
                $scope.reset = function () {
                    var formEle = getFormElement(),
                        prevDataValues;
                    resetFormState();
                    resetFormFields(formEle);
                    if (WM.isArray($scope.formFields)) {
                        prevDataValues = _.fromPairs(_.map($scope.prevDataValues, function (item) {
                            return [item.key, item.value];
                        })); //Convert of array of values to an object
                        $scope.formFields.forEach(function (formField) {
                            formField.value = prevDataValues[formField.key];
                            if (formField.type === 'blob') {
                                resetFileUploadWidget(formField, true);
                                formField.href = $scope.getBlobURL(prevDataValues, formField.key, formField.value);
                            }
                            if (WM.isUndefined(formField.value) && formField.widget === 'autocomplete') { //Empty the query in case of autocomplete widget
                                formEle.find('div[name=' + formField.name + '] input').val('');
                            }
                            $scope.applyFilterOnField(formField);
                        });
                        $scope.constructDataObject();
                    }
                };
                /*clear the formFields*/
                function emptyDataModel() {
                    $scope.formFields.forEach(function (dataValue) {
                        if (WM.isDefined(dataValue)) {
                            if (dataValue.type === 'blob') {
                                resetFileUploadWidget(dataValue);
                            } else {
                                dataValue.value = '';
                            }
                        }
                    });
                }
                /*Method to update, sets the operationType to "update" disables the readonly*/
                $scope.edit = function () {
                    resetFormState();
                    $scope.toggleMessage(false);
                    /*set the formFields into the prevformFields only in case of inline form
                    * in case of dialog layout the set prevformFields is called before manually clearing off the formFields*/

                    if (!$scope.isLayoutDialog) {
                        if ($scope.isSelected) {
                            prevformFields = Utils.getClonedObject($scope.formFields);
                        }
                        /*Set the rowdata to prevDataObject irrespective whether the row is selected
                         or not*/
                        prevDataObject = Utils.getClonedObject($scope.rowdata || {});
                    }
                    $scope.setReadonlyFields();
                    $scope.isUpdateMode = true;
                    $scope.operationType = 'update';
                };
                /*Method clears the fields, sets any defaults if available,
                 disables the readonly, and sets the operationType to "insert"*/
                $scope.new = function () {
                    resetFormState();
                    $scope.toggleMessage(false);
                    if ($scope.isSelected && !$scope.isLayoutDialog) {
                        prevformFields = Utils.getClonedObject($scope.formFields);
                    }
                    if ($scope.formFields && $scope.formFields.length > 0) {
                        emptyDataModel();
                    }
                    $scope.setDefaults();
                    $scope.setPrevDataValues();
                    $scope.constructDataObject();
                    $scope.isUpdateMode = true;
                    $scope.operationType = 'insert';
                };
                $scope.filetypes = {
                    'image' : 'image/*',
                    'video' : 'video/*',
                    'audio' : 'audio/*'
                };
               /*Set if any default values, if given*/
                $scope.setDefaults = function () {
                    $scope.formFields.forEach(function (fieldObj) {
                        $scope.setDefaultValueToValue(fieldObj);
                        $scope.applyFilterOnField(fieldObj);
                    });
                };
                $scope.setDefaultValueToValue = function (fieldObj) {
                    var defaultValue = fieldObj.defaultvalue,
                        fileType;
                    /*Set the default value only if it exists.*/
                    if (WM.isDefined(defaultValue) && defaultValue !== null && defaultValue !== '' && defaultValue !== 'null') {
                        fieldObj.value = LiveWidgetUtils.getDefaultValue(defaultValue, fieldObj.type, fieldObj.widget);
                    } else {
                        fieldObj.value = undefined;
                    }
                    if (fieldObj.type === 'blob') {
                        //Create the accepts string from file type and extensions
                        fileType = fieldObj.filetype ? $scope.filetypes[fieldObj.filetype] : '';
                        fieldObj.permitted = fileType + (fieldObj.extensions ? (fileType ? ',' : '') + fieldObj.extensions : '');
                    }
                    /*If the field is primary but is assigned set readonly false.
                     Assigned is where the user inputs the value while a new entry.
                     This is not editable(in update mode) once entry is successful*/
                    if (fieldObj.readonly && fieldObj.primaryKey && fieldObj.generator === "assigned") {
                        fieldObj.readonly = false;
                    }
                    $scope.setPrevDataValues();
                };
                $scope.setReadonlyFields = function () {
                    if (!$scope.formFields || $scope.widgetid) {
                        return;
                    }
                    $scope.formFields.forEach(function (column) {
                        column.readonly = column._readonly;
                        if (column.primaryKey && !column.isRelated && !column.period) {
                            column.readonly = true;
                        }
                    });
                };
                /*Sets the operationType to "delete" and calls the formSave function to handle the action*/
                $scope.delete = function (callBackFn) {
                    resetFormState();
                    $scope.operationType = "delete";
                    prevDataObject = Utils.getClonedObject($scope.rowdata || {});
                    $scope.formSave(undefined, undefined, undefined, callBackFn);
                };
                /*Check if the data is in required format, i.e, if the field has a key and type*/
                $scope.isInReqdFormat = function (data) {
                    return (WM.isArray(data) && data[0].key && data[0].type);
                };
                /*Function to get the default data object based on the operation type*/
                function getDataObject() {
                    if ($scope.operationType === 'insert') {
                        return {};
                    }
                    if (WM.isDefined(prevDataObject) && !Utils.isEmptyObject(prevDataObject)) {
                        return Utils.getClonedObject(prevDataObject);
                    }
                    return Utils.getClonedObject($scope.formdata || {});
                }
                /*construct the data object from the formFields*/
                $scope.constructDataObject = function (isPreviousData) {
                    var dataObject          = getDataObject(),
                        formName            = $scope.name,
                        formFields,
                        element;
                    formFields = isPreviousData ? prevformFields : $scope.formFields;
                    _.forEach(formFields, function (field) {
                        var dateTime,
                            fieldTarget = _.split(field.key, '.'),
                            fieldName = fieldTarget[0] || field.key,
                            fieldValue;

                        /*collect the values from the fields and construct the object*/
                        /*Format the output of date time widgets to the given output format*/
                        if ((field.widget && Utils.isDateTimeType(field.widget)) || Utils.isDateTimeType(field.type)) {
                            if (field.value) {
                                dateTime = Utils.getValidDateObject(field.value);
                                if (field.outputformat === 'timestamp' || field.type === 'timestamp') {
                                    fieldValue = field.value ? dateTime.getTime() : null;
                                } else if (field.outputformat) {
                                    fieldValue = $filter('date')(dateTime, field.outputformat);
                                } else {
                                    fieldValue = field.value;
                                }
                            } else {
                                fieldValue = undefined;
                            }
                        } else if (field.type === 'blob') {
                            fieldValue = _.get(document.forms, [formName, fieldName + '_formWidget', 'files', 0]);//passing file
                        } else if (field.type === 'list') {
                            fieldValue = field.value || undefined;
                        } else {
                            fieldValue = field.value;
                        }

                        if (fieldTarget.length === 1) {
                            dataObject[fieldName] = fieldValue;
                        } else {
                            dataObject[fieldName]                 = dataObject[fieldName] || {};
                            dataObject[fieldName][fieldTarget[1]] = fieldValue;
                        }
                    });
                    if (!isPreviousData) {
                        element = getFormElement();
                        //Set the values of the widgets inside the live form (other than form fields) in form data
                        LiveWidgetUtils.setFormWidgetsValues($scope, element, dataObject);
                        $scope.dataoutput = dataObject;
                    }
                    return dataObject;
                };


                /*Clear the fields in the array*/
                $scope.clearData = function () {
                    $scope.toggleMessage(false);
                    if ($scope.formFields && $scope.formFields.length > 0) {
                        emptyDataModel();
                    }
                };
                /*Set the form fields to readonly*/
                $scope.setReadonly = function (element) {
                    WM.element(element)
                        .find('input, textarea')
                        .attr('disabled', true);
                };
                /*Disable readonly*/
                $scope.removeReadonly = function (element) {
                    WM.element(element)
                        .find('input, textarea')
                        .attr('disabled', false);
                };
                $scope.isUpdateMode = false;
                /*Function to set the specified column as a primary key by adding it to the primary key array.*/
                $scope.setPrimaryKey = function (columnName) {
                    /*Store the primary key of data*/
                    $scope.primaryKey = $scope.primaryKey || [];
                    if (WM.element.inArray(columnName, $scope.primaryKey) === -1) {
                        $scope.primaryKey.push(columnName);
                    }
                };

                /*Translate the variable rawObject into the formFields for form construction*/
                $scope.translateVariableObject = function (rawObject) {
                    return LiveWidgetUtils.translateVariableObject(rawObject, $scope);
                };
                $scope.getBlobURL = function (dataObj, key, value) {
                    var href = '',
                        primaryKeys,
                        primaryKey;
                    if (value === null || value === undefined || !$scope.variableObj) {
                        return href;
                    }
                    primaryKeys = $scope.variableObj.getPrimaryKey() || [];
                    primaryKey  = dataObj[primaryKeys[0]];
                    if (CONSTANTS.hasCordova && CONSTANTS.isRunMode) {
                        href += $rootScope.project.deployedUrl;
                    }
                    href += (($scope.variableObj._prefabName !== "" && $scope.variableObj._prefabName !== undefined) ? "prefabs/" + $scope.variableObj._prefabName : "services") + '/';
                    href += $scope.variableObj.liveSource + '/' + $scope.variableObj.type + '/' + primaryKey + '/content/' + key + '?' + Math.random();
                    return href;
                };
                $scope.changeDataObject = function (dataObj) {
                    if (!$scope.formFields || $scope.widgetid || !dataObj) {
                        return;
                    }
                    $scope.formFields.forEach(function (formField) {
                        var value = _.get(dataObj, formField.key);
                        if (isTimeType(formField)) {
                            formField.value = getValidTime(value);
                        } else if (formField.type === 'blob') {
                            resetFileUploadWidget(formField, true);
                            formField.href  = $scope.getBlobURL(dataObj, formField.key, value);
                            formField.value = value;
                        } else {
                            formField.value = value;
                        }
                        $scope.applyFilterOnField(formField);
                    });
                    $scope.setPrevDataValues();
                    $scope.constructDataObject();
                };

                $scope.setFieldVal = function (fieldDef) {
                    var dataObj = $scope.rowdata || $scope.formdata,
                        value   = _.get(dataObj, fieldDef.key);
                    if (!dataObj) {
                        return;
                    }
                    if (isTimeType(fieldDef)) {
                        fieldDef.value = getValidTime(value);
                    } else if (fieldDef.type === 'blob') {
                        fieldDef.href  = $scope.getBlobURL(dataObj, fieldDef.key, value);
                        fieldDef.value = value;
                    } else {
                        fieldDef.value = value;
                    }
                    $scope.dataoutput = $scope.dataoutput || {};
                    $scope.dataoutput[fieldDef.key] = fieldDef.value;
                };

                /*For related fields, get the display value from the object*/
                $scope.getDisplayExpr = LiveWidgetUtils.getDisplayExpr.bind(undefined, $scope);
                /*returns the default output formats for date time types*/
                $scope.getOutputPatterns = function (type, outputFormat) {
                    if (Utils.isDateTimeType(type)) {
                        return Utils.getDateTimeFormatForType(type);
                    }
                    return outputFormat;
                };

                $scope.cancel = function () {
                    $scope.formCancel();
                };
                /*For backward compatibility of update action*/
                $scope.update = function () {
                    $scope.edit();
                };
                //Set form widgets scopes on live form
                this.populateFormWidgets = LiveWidgetUtils.populateFormWidgets.bind(undefined, $scope, 'formWidgets');
                $scope.populateFormWidgets = LiveWidgetUtils.populateFormWidgets.bind(undefined, $scope, 'formWidgets');

                //Highlight all the invalid states on save
                $scope.highlightInvalidFields = function () {
                    var $formEle     = getFormElement(),
                        formScope    = ($scope.isLayoutDialog && $formEle.length) ? $formEle.scope() : $scope;

                    LiveWidgetUtils.highlightInvalidFields(formScope.ngform);
                };
                //method to show/ hide actions bar
                $scope.showButtons = function (position) {
                    return _.some($scope.buttonArray, function (btn) {
                        return _.includes(btn.position, position) && btn.updateMode === $scope.isUpdateMode;
                    });
                };

                $scope.applyFilterOnField = LiveWidgetUtils.applyFilterOnField.bind(undefined, $scope);
            },
            compile: function ($tEl) {
                return {
                    pre: function (scope, element, attrs) {
                        var elScope = element.scope();

                        scope.widgetProps = attrs.widgetid ? Utils.getClonedObject(widgetProps) : widgetProps;

                        /*check for formtype or layout values for backward compatability*/
                        if (attrs.formtype || attrs.layout) {
                            attrs.formlayout = attrs.formtype || attrs.layout;
                        }

                        //handle the backward compatibility for no validate
                        if (attrs.novalidate) {
                            if (!attrs.validationtype) {
                                scope.validationtype = attrs.validationtype = (attrs.novalidate === 'true' ? 'none' : 'default');
                                WM.element($tEl.context).attr('validationtype', scope.validationtype);
                            }
                            delete attrs.novalidate;
                        }

                        /*enable the form layout for device. For dialog, mode do not show it*/
                        if ($rootScope.isMobileApplicationType && CONSTANTS.isStudioMode && attrs.formlayout !== 'dialog') {
                            scope.widgetProps.formlayout.show = true;
                            scope.widgetProps.formlayout.showindesigner = true;
                        }

                        if (attrs.formlayout === 'dialog') {
                            scope.isLayoutDialog = true;
                            scope._dialogid = attrs.dialogid;
                        }
                        /*This is to make the "Variables" & "Widgets" available in the Grid scope.
                         * and "Variables", "Widgets" will not be available in that scope.
                         * element.scope() might refer to the controller scope/parent scope.*/
                        scope.Variables  = elScope.Variables;
                        scope.Actions    = elScope.Actions;
                        scope.Widgets    = elScope.Widgets;
                        scope.appLocale  = $rootScope.appLocale;
                        scope.pageParams = elScope.pageParams;
                        element.removeAttr('title');
                    },
                    post: function (scope, element, attrs, controller) {
                        scope.ctrl = controller;
                        scope.ngform = scope[scope.name];
                        scope.dataoutput = {};
                        if (attrs.formlayout !== 'dialog') {
                            scope.formElement = element;
                        } else {
                            /* for dialog layout dialog will take the width assigned to the form */
                            if (CONSTANTS.isRunMode) {
                                scope.dialogWidth = scope.width;
                                scope.width = "100%";
                            }
                        }
                        scope.element = element;
                        var handlers = [];

                        scope.getActiveLayout = function () {
                            return LiveWidgetUtils.getColumnCountByLayoutType(scope.layout, +scope.element.find('.app-grid-layout:first').attr('columns'));
                        };

                        // returns the grid object when dataset is empty
                        function getEmptyDataSetGridObj() {
                            return {
                                widgetName: scope.name,
                                fieldDefs: [],
                                buttonDefs: [],
                                scopeId: scope.$id,
                                numColumns: scope.getActiveLayout()
                            };
                        }

                        // returns the grid object when dataset is not empty
                        function getNonEmptyDatSetGridObj() {
                            return {
                                widgetName: scope.name,
                                fieldDefs: scope.formFields,
                                buttonDefs: scope.buttonArray,
                                scopeId: scope.$id,
                                numColumns: scope.getActiveLayout()
                            };
                        }

                        /* Define the property change handler. This function will be triggered when there is a change in the widget property */
                        function propertyChangeHandler(key, newVal, oldVal) {
                            var value,
                                translatedObj,
                                tempVarName,
                                gridObj,
                                variableObj,
                                layoutConfig,
                                elScope = element.scope();

                            switch (key) {
                            case 'dataset':
                                /*Process the dataset if only the data is an array*/
                                if (newVal && newVal.propertiesMap && WM.isArray(newVal.propertiesMap.columns)) {
                                    if (!oldVal || !oldVal.propertiesMap || !WM.equals(newVal.propertiesMap.columns, oldVal.propertiesMap.columns)) {
                                        tempVarName = Utils.getVariableName(scope);
                                        if (scope.variableName && (tempVarName !== scope.variableName)) {
                                            scope.formCreated = false;
                                            scope.formConstructed = false;
                                        }
                                        scope.variableName = tempVarName;
                                        /*Check if form has been created, if true translate the variable object.*/
                                        if ((scope.formCreated || scope.formConstructed) && scope.formFields) {
                                            translatedObj = scope.translateVariableObject(newVal);
                                            scope.translatedObj = translatedObj;
                                            /*Check if the formFields is defined, then in the formFields array override only certain fields.*/
                                            scope.formFields.forEach(function (fieldObject) {
                                                if (!fieldObject) {
                                                    return;
                                                }
                                                translatedObj.forEach(function (transObj) {
                                                    if (transObj.key === fieldObject.key) {
                                                        fieldObject.isRelated = transObj.isRelated;
                                                        fieldObject.type = transObj.type; /*Set the type of the column to the default variable type*/
                                                    }
                                                });
                                            });

                                            variableObj =  _.get(elScope, 'Variables.' + scope.variableName);
                                            scope.variableObj = variableObj;
                                            if (variableObj) {
                                                /* set the variable type info to the live-form selected-entry type, so that type matches to the variable for which variable is created*/
                                                scope.widgetProps.formdata.type = variableObj.type;
                                                scope.widgetProps.dataoutput.type = 'object, ' + variableObj.type;
                                            }
                                        } else {
                                            /*Defining two buttons for default actions*/
                                            scope.buttonArray = LiveWidgetUtils.getLiveWidgetButtons('LIVEFORM').filter(function (button) {
                                                /* show only save button for liveform with page layout */
                                                return scope.formlayout === 'page' ? button.key === 'save' : button.key === 'cancel' || button.key === 'save';
                                            });
                                            variableObj = _.get(elScope, 'Variables.' + scope.variableName);
                                            scope.variableObj = variableObj;
                                            if (variableObj) {
                                                /* set the variable type info to the live-form selected-entry type, so that type matches to the variable for which variable is created*/
                                                scope.widgetProps.formdata.type = variableObj.type;
                                            }
                                            /*Check if the newVal is in the required format, checking for key and type for each field,
                                             * else call the translateVariableObject method*/
                                            if (scope.isInReqdFormat(newVal)) {
                                                translatedObj = newVal;
                                            } else {
                                                translatedObj = scope.translateVariableObject(newVal);
                                            }
                                            scope.translatedObj = translatedObj;
                                            scope.formFields = translatedObj;
                                        }
                                        gridObj = getNonEmptyDatSetGridObj();
                                    }
                                } else if (newVal) {
                                    scope.variableName = Utils.getVariableName(scope);
                                    scope.variableObj  = _.get(elScope, 'Variables.' + scope.variableName);
                                } else {
                                    scope.variableName = '';
                                    scope.variableObj  = undefined;
                                    /*When initially a variable is bound to the live-form the form is constructed and the
                                     markup is updated with the form field action and button directives*/
                                    gridObj = getEmptyDataSetGridObj();
                                }
                                if (CONSTANTS.isStudioMode && gridObj && (!scope.formFieldCompiled || scope.newcolumns)) {
                                    scope.newcolumns = false;
                                    gridObj.bindDataSetChanged = true;
                                    gridObj.widgettype = scope.widgettype;
                                    Utils.getService('LiveWidgetsMarkupManager').updateMarkupForLiveForm(gridObj);
                                }
                                _.forEach(scope.formFields, function (field) {
                                    if (field) {
                                        if (field.primaryKey) {
                                            scope.setPrimaryKey(field.key);
                                        }
                                        //Set output format for date time types
                                        field.outputformat = scope.getOutputPatterns(field.type, field.outputformat);
                                    }
                                });
                                break;
                            case 'novalidate':
                                //Set validation type based on the novalidate property
                                scope.validationtype = (newVal === true || newVal === 'true') ? 'none' : 'default';
                                break;
                            case 'validationtype':
                                LiveWidgetUtils.setFormValidationType(scope);
                                break;
                            case 'autocomplete':
                                /*Set the auto complete on/off based on the input*/
                                if (scope.formlayout !== 'dialog') {
                                    value = (newVal === true || newVal === 'true') ? 'on' : 'off';
                                    element.attr(key, value);
                                }
                                break;
                            case 'rowdata':
                                if (newVal && WM.isObject(newVal)) {
                                    scope.changeDataObject(newVal);
                                }
                                break;
                            case 'formdata':
                                if (newVal && WM.isObject(newVal)) {
                                    if (_.isArray(newVal)) {
                                        scope.changeDataObject(_.last(newVal));
                                    } else {
                                        scope.changeDataObject(newVal);
                                    }
                                }
                                break;
                            case 'updatemode':
                                scope.isUpdateMode = (newVal === true || newVal === 'true');
                                break;
                            case 'defaultmode':
                                if (newVal && newVal === 'Edit') {
                                    scope.updateMode = true;
                                } else {
                                    scope.updateMode = false;
                                }
                                scope.isUpdateMode = scope.updateMode;
                                break;
                            case 'formlayout':
                                scope.isLayoutDialog = newVal === 'dialog';
                                element.toggleClass('liveform-dialog', scope.isLayoutDialog);
                                // show backbtn event for page formlayout
                                if (CONSTANTS.isStudioMode) {
                                    scope.widgetProps.onBackbtnclick.show = (newVal === 'page');
                                }
                                break;
                            case 'captionalign':
                                scope.captionAlignClass = 'align-' + newVal;
                                break;
                            case 'captionposition':
                            case 'captionwidth':
                                layoutConfig = LiveWidgetUtils.getFieldLayoutConfig(scope.captionwidth, scope.captionposition);
                                scope._captionClass = layoutConfig.captionCls;
                                scope._widgetClass  = layoutConfig.widgetCls;
                                break;
                            }
                        }

                        /* register the property change handler */
                        WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler, scope, notifyFor);
                        Object.defineProperty(scope, 'mode', {
                            'get': function () {
                                return scope.operationType || scope.findOperationType();
                            }
                        });
                        if (scope.widgetid) {
                            /* event emitted on building new markup from canvasDom */
                            handlers.push($rootScope.$on('compile-live-form-fields', function (event, scopeId, markup, fromDesigner) {
                                /* as multiple form directives will be listening to the event, apply field-definitions only for current form */
                                if (scope.$id === scopeId) {

                                    if ($rootScope.isMobileApplicationType && CONSTANTS.isStudioMode) {
                                        if (scope.formlayout === 'page') {
                                            // recompile the pageTemplate.
                                            element.html(pageTemplate);
                                            scope.buttonArray = undefined;
                                            $compile(element.contents())(scope);
                                            element.addClass('app-device-liveform');
                                        } else {
                                            // recompile the default template
                                            element.html(defaultTemplate);
                                            element.find('.basic-btn-grp').empty();
                                            $compile(element.contents())(scope);
                                            element.removeClass('app-device-liveform').addClass('app-liveform');
                                        }
                                    }

                                    scope.formFields = undefined;
                                    scope.buttonArray = undefined;
                                    element.find('.form-elements').empty();
                                    element.find('.basic-btn-grp').empty();
                                    scope.formConstructed = fromDesigner;
                                    /*If the event has been emitted after changes in the liveFormDesigner then empty the form and reconstruct*/
                                    if (markup) {
                                        scope.formConstructed = true;
                                        var markupObj = WM.element('<div>' + markup + '</div>'),
                                            fieldsObj = markupObj.find('> :not(wm-form-action)'), // select nodes other than form-actions
                                            actionsObj = markupObj.find('> wm-form-action'); // select form-action nodes

                                        /* if layout grid template found, simulate canvas dom addition of the elements */
                                        if (fieldsObj) {
                                            $rootScope.$emit('prepare-element', fieldsObj, function () {
                                                element.find('.form-elements').append(fieldsObj);
                                                element.find('.basic-btn-grp').append(actionsObj);
                                                $compile(fieldsObj)(scope);
                                                $compile(actionsObj)(scope);
                                            });
                                        } else {
                                            /* else compile and add the form fields */
                                            fieldsObj = markupObj.find('wm-form-field');
                                            element.find('.form-elements').append(fieldsObj);
                                            element.find('.basic-btn-grp').append(actionsObj);
                                            $compile(fieldsObj)(scope);
                                            $compile(actionsObj)(scope);
                                        }
                                        //on canvas update update widgets of form
                                    }
                                }
                            }));
                        }
                        scope.$on("$destroy", function () {
                            handlers.forEach(Utils.triggerFn);
                        });

                        WidgetUtilService.postWidgetCreate(scope, element, attrs);
                        //Add widgets to form on load

                        function initDependency(widgetname) {
                            var dependsonWidget = scope.Widgets[widgetname],
                                eventChangeHandler;
                            if (dependsonWidget) {
                                scope.subscribedWidget = dependsonWidget;
                                eventChangeHandler = function (event, widgetid, eventName) {
                                    if (widgetid === scope.subscribedWidget.name) {
                                        /* handle operation change */
                                        switch (eventName) {
                                        case 'create':
                                            scope.operationType = 'insert';
                                            scope.isSelected = true;
                                            scope.rowdata = '';
                                            /*In case of dialog layout set the previous data Array before clearing off*/
                                            if (scope.isLayoutDialog) {
                                                scope.setPrevformFields(scope.formFields);
                                                scope.formFields = [];
                                            }
                                            scope.new();
                                            if (scope.isLayoutDialog) {
                                                DialogService.showDialog(scope._dialogid, { 'resolve': {}, 'scope' : scope });
                                            }
                                            break;
                                        case 'update':
                                            scope.operationType = 'update';
                                            scope.isSelected = true;
                                            /*In case of dialog layout set the previous data Array before clearing off*/
                                            if (scope.isLayoutDialog) {
                                                scope.setPrevformFields(scope.formFields);
                                                scope.formFields = [];
                                            }
                                            scope.edit();
                                            scope.$root.$safeApply(scope);
                                            if (scope.isLayoutDialog) {
                                                /*Open the dialog in view or edit mode based on the defaultmode property*/
                                                scope.isUpdateMode = true;
                                                DialogService.showDialog(scope._dialogid, {'resolve': {}, 'scope': scope});
                                            }
                                            break;
                                        case 'read':
                                            scope.isUpdateMode = false;
                                            break;
                                        case 'delete':
                                            scope.operationType = 'delete';
                                            scope.subscribedWidget.call('delete', {"row": scope.constructDataObject()}, function () {
                                                scope.toggleMessage(true, scope.deletemessage, 'success');
                                            }, function (error) {
                                                scope.toggleMessage(true, scope.errormessage || error, 'error');
                                            });
                                            break;
                                        }
                                    }
                                };
                                handlers.push(dependsonWidget.$watch('selectedItems', function (newVal) {
                                    if (newVal && newVal.length) {
                                        scope.rowdata = newVal[newVal.length - 1];
                                        if (scope.isUpdateMode) {
                                            eventChangeHandler(null, dependsonWidget.widgetid, "update");
                                        }
                                    }
                                }));
                                handlers.push($rootScope.$on('wm-event', eventChangeHandler));
                            }
                        }
                        if (attrs.dependson && CONSTANTS.isRunMode) {
                            initDependency(attrs.dependson);
                        }
                    }
                };
            }
        };
    }])
    .directive("wmFormField", ["Utils", "$compile", "CONSTANTS", "BindingManager", "LiveWidgetUtils", "WidgetUtilService", function (Utils, $compile, CONSTANTS, BindingManager, LiveWidgetUtils, WidgetUtilService) {
        'use strict';
        var isDataSetWidgets = Utils.getDataSetWidgets();
        return {
            "restrict": 'E',
            "template": "<div init-widget data-role='form-field'></div>",
            "scope": {},
            "replace": true,
            "compile": function (tElement) {
                return {
                    "pre": function (scope, element, attrs) {
                        LiveWidgetUtils.preProcessFields('wm-form-field', scope, attrs, tElement);
                    },
                    "post": function (scope, element, attrs) {
                        scope.FieldDef = function () {};
                        scope.FieldDef.prototype = new wm.baseClasses.FieldDef();
                        scope.getCutomizedOptions = LiveWidgetUtils.getCutomizedOptions;
                        /*scope.$parent is defined when compiled with live filter scope*/
                        /*element.parent().isolateScope() is defined when compiled with dom scope*/
                        var parentScope,
                            template,
                            index,
                            columnDef = new scope.FieldDef(),
                            expr,
                            exprWatchHandler,
                            elScope = element.scope(),
                            defaultObj,
                            isLayoutDialog,
                            externalForm = element.closest('form.app-form, form.app-liveform').is('form.app-form'), //Check if nearest parent form is wm-form
                            parentEle    = element.parent(),
                            columnDefProps;
                        function setDefaultValue() {
                            if (parentScope._widgettype === 'wm-liveform') {
                                parentScope.setDefaultValueToValue(columnDef);
                            } else {
                                columnDef.value =  LiveWidgetUtils.getDefaultValue(columnDef.defaultvalue, undefined, columnDef.widget);
                            }
                            parentScope.applyFilterOnField(columnDef);
                            parentScope.constructDataObject();
                        }
                        function setValidity(name, val) {
                            var formWidget = parentScope.ngform[name + '_formWidget'];
                            if (!formWidget) {
                                return;
                            }
                            formWidget.$setValidity('custom', val);
                        }
                        if (parentEle.length) {
                            parentScope = externalForm ? parentEle.closest('form.app-form').isolateScope().elScope : parentEle.closest('[data-identifier="liveform"]').isolateScope() || scope.$parent;
                        } else {
                            parentScope = scope.$parent;
                        }
                        scope.parentScope = parentScope;
                        isLayoutDialog = parentScope.isLayoutDialog;
                        columnDefProps = WM.extend(LiveWidgetUtils.getColumnDef(attrs), {
                            'key'    : attrs.key || attrs.target || attrs.binding || attrs.name,
                            'regexp' : attrs.regexp || ".*"
                        });
                        columnDefProps.validationmessage = (CONSTANTS.isRunMode && _.startsWith(attrs.validationmessage, 'bind:')) ? '' :  attrs.validationmessage;

                        //Get viewmodewidget from attributes. If not present, get the default view mode widget based on the widget type
                        columnDefProps.viewmodewidget = attrs.viewmodewidget || LiveWidgetUtils.getDefaultViewModeWidget(columnDefProps.widget);

                        scope.FieldDef.prototype.$is = parentScope;
                        WM.extend(columnDef, columnDefProps);
                        attrs.isRelated =  attrs.isRelated === "true" || attrs.primaryKey === true;
                        columnDef.isRelated = attrs.isRelated;
                        /*if the show property is set to false, set the required property to false (except for identity columns)
                         * This will prevent 'required field can not be focused' error*/
                        if (CONSTANTS.isRunMode && columnDef.show === false) {
                            columnDef.required = false;
                        }
                        /*Set below properties on the scope, as post widget create is not called for this directive */
                        scope.required = columnDef.required;
                        scope.readonly = columnDef.readonly;
                        scope.disabled = columnDef.disabled;
                        scope.multiple = columnDef.multiple;
                        //For normal form is update mode won't be set on parent scope, set it explicitly based on isupdatemode attribute
                        if (scope.isupdatemode === 'true') {
                            parentScope.isUpdateMode = true;
                        }

                        scope.fieldDefConfig = columnDef;
                        parentScope.formFields = _.isArray(parentScope.formFields) ?  parentScope.formFields : [];
                        index = _.indexOf(parentScope.formFields, undefined);
                        index = index > -1 ? index : parentScope.formFields.length;
                        scope.index = index;
                        parentScope.formFields[index] = columnDef;

                        /*If defaultValue is set then assign it to the attribute*/
                        if (attrs.defaultvalue) {
                            if (Utils.stringStartsWith(attrs.defaultvalue, 'bind:') && CONSTANTS.isRunMode) {
                                expr = attrs.defaultvalue.replace('bind:', '');
                                exprWatchHandler = BindingManager.register(parentScope, expr, function (newVal) {
                                    parentScope.formFields[index].defaultvalue = newVal;
                                    if (parentScope.operationType !== 'update') {
                                        setDefaultValue();
                                    }
                                }, {"deepWatch": true, "allowPageable": true, "acceptsArray": false}, 'datavalue');
                            } else {
                                columnDef.defaultvalue = attrs.defaultvalue;
                                if (CONSTANTS.isRunMode) {
                                    setDefaultValue();
                                }
                            }
                        }
                        if (CONSTANTS.isRunMode) {
                            if (attrs.dataset) {
                                /*If dataset is undefined, fetch the default values for field*/
                                columnDef.isDataSetBound = true;
                            } else {
                                if (isDataSetWidgets[columnDef.widget]) {
                                    if (attrs.isRelated) {
                                        //Fetch the data for the related fields
                                        columnDef.isDataSetBound = true;
                                        LiveWidgetUtils.fetchRelatedFieldData(columnDef, columnDef.key, 'All Fields', columnDef.widget, elScope, parentScope);
                                    } else {
                                        LiveWidgetUtils.getDistinctValuesForField(parentScope, columnDef, 'widget');
                                    }
                                }
                            }
                        }

                        if (isLayoutDialog) {
                            parentScope.ngform = parentScope[parentScope.name];
                            defaultObj = _.find(parentScope.translatedObj, function (obj) {
                                return obj.key === columnDef.key;
                            });
                            if (defaultObj) {
                                columnDef.isRelated = defaultObj.isRelated;
                                columnDef.type = defaultObj.type;
                                columnDef.outputformat = parentScope.getOutputPatterns(columnDef.type, columnDef.outputformat);
                            }
                            parentScope.setDefaultValueToValue(columnDef);
                            parentScope.setFieldVal(columnDef);
                            if (parentScope.operationType === 'update') {
                                parentScope.setReadonlyFields();
                            }
                        }
                        if (isLayoutDialog) {
                            parentScope.setPrevDataValues();
                        }
                        parentScope.formCreated = true;
                        parentScope.formFieldCompiled = true;
                        /* this condition will run for:
                         *  1. PC view in STUDIO mode
                         *  2. Mobile/tablet view in RUN mode
                         */
                        if (CONSTANTS.isRunMode) {
                            if (Utils.isMobile()) {
                                if (!columnDef.mobileDisplay) {
                                    return;
                                }
                            } else {
                                if (!columnDef.pcDisplay) {
                                    return;
                                }
                            }
                        }

                        template = LiveWidgetUtils.getTemplate(columnDef, index, element);
                        //Remove only live-field so that overlay won't get overrided
                        element.find('.live-field').remove();
                        element.append(template);
                        $compile(element.contents())(parentScope);

                        parentScope._onFocusField = parentScope._onFocusField ||  function ($event) {
                            WM.element($event.target).closest('.live-field').addClass('active'); //On focus of the field, add active class
                        };
                        parentScope._onBlurField = parentScope._onBlurField || function ($event) {
                            var $field     = WM.element($event.target).closest('.live-field'),
                                fieldScope = $field.parent('[data-role="form-field"]').isolateScope();
                            $field.removeClass('active');
                            setValidity(fieldScope && fieldScope.name, true);
                        };

                        function _onChangeField($is) {
                            var formIndex = _.get($is.$element.closest('[data-role="form-field"]').isolateScope(), 'index');
                            if (WM.isDefined(formIndex)) {
                                parentScope.constructDataObject();
                                parentScope.applyFilterOnField(parentScope.formFields[formIndex]);
                            }
                        }
                        //On change of a field, update the dataoutput on form/liveform
                        parentScope._onChangeField = parentScope._onChangeField || function ($event, $is) {
                            _onChangeField($is);
                        };
                        //On submit of a autocomplete field, update the dataoutput on form/liveform
                        parentScope._onSubmitField = parentScope._onSubmitField || function ($event, $is) {
                            _onChangeField($is);
                        };
                        parentScope.$on('$destroy', function () {
                            if (exprWatchHandler) {
                                exprWatchHandler();
                            }
                        });
                        // when the form-field element is removed, remove the corresponding entry from parentIScope.formFields
                        element.on('$destroy', function () {
                            if (CONSTANTS.isRunMode) {
                                _.pullAt(parentScope.formFields, _.indexOf(parentScope.formFields, columnDef));
                            } else {
                                _.set(parentScope.formFields, index, undefined);
                            }
                        });
                        WidgetUtilService.registerPropertyChangeListener(LiveWidgetUtils.fieldPropertyChangeHandler.bind(undefined, scope, element, attrs, parentScope, index), scope);

                        LiveWidgetUtils.setGetterSettersOnField(scope, element);

                        scope.setValidationMessage = function (val) {
                            _.set(parentScope, ['formFields', [index], 'validationmessage'], val);
                            setValidity(scope.name, false);
                        };
                        parentScope.formfields = parentScope.formfields || {};
                        parentScope.formfields[columnDef.key] = columnDef;
                        //tabindex should be only on the input fields, remove tabindex on form field
                        element.removeAttr('tabindex');

                        // Save the original readonly state
                        columnDef._readonly = columnDef.readonly;


                        //Evaluate type for datavalue based on the dataset
                        if (scope.widgetid) {
                            scope.getDataValueType = function () {
                                var propertyType,
                                    bindDataSet = scope.binddataset,
                                    TypeUtils = Utils.getService('TypeUtils');
                                //If dataset is not bound, get it from liveform dataset
                                if (!bindDataSet && _.get(parentScope, 'binddataset')) {
                                    bindDataSet = _.get(parentScope, 'binddataset') + '.' + scope.key;
                                }
                                propertyType = TypeUtils.getTypeForExpression(bindDataSet, scope);
                                return propertyType;
                            };
                        }
                    }
                };
            }
        };
    }])
    .directive('wmFormAction', ['$compile', 'CONSTANTS', 'LiveWidgetUtils', function ($compile, CONSTANTS, LiveWidgetUtils) {
        'use strict';

        var getTemplate = function (btnField, index) {
            var template, widgetType, disabledTl = '';
            if (btnField.widgetType === 'button') {
                widgetType =  'wm-button';
                disabledTl =  ' disabled="' + btnField.disabled + '"';
            } else {
                widgetType =  'wm-anchor';
            }
            template = '<' + widgetType + ' name="' + btnField.key + '" caption="' + btnField.displayName + '" class="' + btnField.class + '" iconclass="' + btnField.iconclass + '"" on-click="' + btnField.action + '" type="' + btnField.type + '" ' +
                'hint="' + btnField.title + '"  shortcutkey="' + btnField.shortcutkey + '"  ' + disabledTl + 'tabindex="' + btnField.tabindex + '"';
            if (btnField.updateMode) {
                template  = template + ' show="{{isUpdateMode && buttonArray[' + index + '].show}}"';
            } else {
                template  = template + ' show="{{!isUpdateMode && buttonArray[' + index + '].show}}"';
            }
            template = template + '></' + widgetType + '>';
            return template;
        };

        return {
            "restrict": 'E',
            "scope": true,
            "replace": true,
            "template": "<div></div>",
            "compile": function () {
                return {
                    "post": function (scope, element, attrs) {
                        /*scope.$parent is defined when compiled with live filter scope*/
                        /*element.parent().isolateScope() is defined when compiled with dom scope*/
                        var parentScope,
                            template,
                            index,
                            $liveForm,
                            parentEle = element.parent(),
                            externalForm = element.closest('form.app-form, form.app-liveform').is('form.app-form'), //Check if nearest parent form is wm-form
                            buttonDef = WM.extend(LiveWidgetUtils.getButtonDef(attrs), {
                                /*iconame support for old projects*/
                                'iconname': attrs.iconname,
                                'type': attrs.type || 'button',
                                'updateMode': WM.isDefined(attrs.updateMode) ?  (attrs.updateMode === true || attrs.updateMode === 'true') : true,
                                'widgetType': attrs.widgetType || 'button',
                                'hyperlink': attrs.hyperlink,
                                'target': attrs.target
                            });

                        if (CONSTANTS.isRunMode && scope.isLayoutDialog) {
                            parentScope = scope;
                        } else {
                            parentScope = (parentEle && parentEle.length > 0) ?
                                (externalForm ? parentEle.closest('form.app-form').isolateScope().elScope : (parentEle.closest('[data-identifier="liveform"]').isolateScope() || scope.$parent)) : scope.$parent;
                        }
                        scope.parentScope = parentScope;
                        buttonDef.position = attrs.position || 'footer';
                        parentScope.buttonArray = parentScope.buttonArray || [];
                        index = parentScope.buttonArray.push(buttonDef) - 1;
                        parentScope.formCreated = true;
                        parentScope.formFieldCompiled = true;
                        template = getTemplate(buttonDef, index);
                        $liveForm = externalForm ? parentEle.closest('form.app-form') : element.closest('[data-identifier="liveform"]');

                        if (scope.formlayout === 'page') {
                            /* add actions to the buttonArray*/
                            scope.buttonArray[index].action = buttonDef.action;
                        } else {
                            if (parentScope.isLayoutDialog) {
                                $liveForm.find('>.basic-btn-grp').append($compile(template)(parentScope));
                            } else {
                                /*append the buttons template to element with class basic-btn-grp*/
                                if (_.includes(buttonDef.position, 'header')) {
                                    $liveForm.find('>.panel-heading .basic-btn-grp').append($compile(template)(parentScope));
                                }
                                if (_.includes(buttonDef.position, 'footer')) {
                                    $liveForm.find('>.panel-footer.basic-btn-grp').append($compile(template)(parentScope));
                                }
                            }
                        }
                        //Removing the default template for the directive
                        element.remove();
                    }
                };
            }
        };
    }])
    .directive('wmValidFile', function () {
        'use strict';
        //For blob type required fields, even if file is present, required error is shown.
        //To prevent this, if value is present call render to apply validation
        return {
            'require' : 'ngModel',
            'link'    : function (scope, el, attrs, ngModel) {
                //change event is fired when file is selected
                el.bind('change', function () {
                    scope.$apply(function () {
                        ngModel.$setViewValue(el.val());
                        ngModel.$render();
                    });
                });
            }
        };
    })
    .directive('liveFormWithDialog', function () {
        'use strict';
        //This directive is used to populate form widgets on live form scope in live form dialog mode
        return {
            'restrict': 'A',
            'controller': function ($scope) {
                this.populateFormWidgets = $scope.populateFormWidgets;
            }
        }
    });

/**
 * @ngdoc directive
 * @name wm.widgets.live.directive:wmLiveform
 * @restrict E
 *
 * @description
 * The 'wmLiveform' directive defines a live-form in the layout.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires $compile
 * @requires $rootScope
 * @requires CONSTANTS
 * @requires $controller
 * @requires Utils
 *
 * @param {string=} name
 *                  Name of the form widget.
 * @param {string=} title
 *                  Title of the form widget.
 * @param {string=} width
 *                  Width of the form widget.
 * @param {string=} height
 *                  Height of the form widget.
 * @param {string=} formdata
 *                  This property sets the data to show in the form. <br>
 *                  This is a bindable property.
 * @param {string=} dataset
 *                  This property sets a variable to populate the data required to display the list of values. <br>
 *                  This is a bindable property.
 * @param {boolean=} novalidate
 *                  This property sets novalidate option for the form. <br>
 *                  default value: `true`.
 * @param {string=} insertmessage
 *                  This property sets the message to be displayed in toaster, when data is inserted in liveform. <br>
 *                  default value: `Record added successfully`. <br>
 *                  This is a bindable property.
 * @param {string=} updatemessage
 *                  This property sets the message to be displayed in toaster, when data is updated in liveform. <br>
 *                  default value: `Record updated successfully`. <br>
 *                  This is a bindable property.
 * @param {boolean=} show
 *                  This is a bindable property. <br>
 *                  This property will be used to show/hide the form on the web page. <br>
 *                  default value: `true`.
 * @param {boolean=} autocomplete
 *                  Sets autocomplete for the form.  <br>
 *                  Default value is `true`.
 * @param {boolean=} updatemode
 *                  This property controls whether live form is on updatemode or not.  <br>
 *                  Default value is `false`.
 * @param {string=} captionalign
 *                  Defines the alignment of the caption elements of widgets inside the form. <br>
 *                  Possible values are `left`, `center`, and `right`. <br>
 *                  Default value for captionalign is `left`.
 * @param {string=} captionposition
 *                  Defines the position of the caption elements of widgets inside the form.<br>
 *                  Possible values are `left`, `center`, and `right`. <br>
 *                  Default value for captionposition is `left`.
 * @param {string=} captionsize
 *                  This property sets the width of the caption.
 * @param {string=} iconclass
 *                  This property defines the class of the icon that is applied to the button. <br>
 *                  This is a bindable property.
 * @param {string=} horizontalalign
 *                  This property used to set text alignment horizontally. <br>
 *                  Possible values are `left`, `center` and `right`.
 * @param {string=} on-success
 *                  Callback function which will be triggered when the form submit is success.
 * @param {string=} on-error
 *                  Callback function which will be triggered when the form submit results in an error.
 * @param {string=} on-result
 *                  Callback function which will be triggered when the form submitted.
 * @param {string=} on-beforeservicecall
 *                  Callback function which will be triggered before the service call.
 *
 * @example
     <example module="wmCore">
         <file name="index.html">
             <wm-liveform>
                 <wm-composite widget="text">
                 <wm-label></wm-label>
                 <wm-text></wm-text>
                 </wm-composite>
                 <wm-composite widget="textarea">
                 <wm-label></wm-label>
                 <wm-textarea></wm-textarea>
                 </wm-composite>
             </wm-liveform>
         </file>
     </example>
 */
