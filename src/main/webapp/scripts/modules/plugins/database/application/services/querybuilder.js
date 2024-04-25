/*global WM, wm, moment, _*/
/**
 * @ngdoc service
 * @name wm.database.$QueryBuilder
 * @requires $rootScope
 * @requires DatabaseService
 * @requires Utils
 * @description
 * The `$QueryBuilder` provides services to build and execute queries.
 *
 */

wm.plugins.database.services.QueryBuilder = [
    "$rootScope",
    "DatabaseService",
    "Utils",
    "ProjectService",
    "DB_CONSTANTS",
    function ($rootScope, DatabaseService, Utils, ProjectService, DB_CONSTANTS) {
        'use strict';
        var matchModes = DB_CONSTANTS.DATABASE_MATCH_MODES;
        function getFieldValue(value, type) {
            return (Utils.isNumberType(type) || type === 'boolean') ? value : "'" + value + "'";
        }
        return {
            'getQuery': function (options) {
                var selectClause,
                    columnClause = '',
                    fromClause,
                    whereClause = '',
                    groupByClause,
                    orderByClause,
                    logicalOp = options.logicalOp && options.logicalOp.toLowerCase() === 'or' ? ' OR ' : ' AND ',
                    logicalOpSliceLength = logicalOp === ' OR ' ? -4 : -5,
                    query,
                    whereParams = [],
                    fields = [],
                    dateTypes = ['timestamp', 'datetime', 'time', 'date'];

                selectClause = 'SELECT ';

                if (options.columns) {
                    columnClause = '';
                    WM.forEach(options.columns, function (column) {
                        columnClause += column + ',';
                    });
                    columnClause = columnClause.slice(0, -1);
                } else {
                    selectClause = '';
                }

                fromClause = ' FROM ' + options.tableName;
                if (_.isArray(options.filterFields) && options.filterFields.length) {
                    _.forEach(options.filterFields, function (field) {
                        var param,
                            matchModeExpr,
                            filterCondition = matchModes[field.matchMode],
                            fieldValue;
                        if (field.clause) {
                            param = field.clause;
                        } else {
                            if (!filterCondition) {
                                filterCondition = _.isArray(field.value) ? matchModes.in : matchModes.exact;
                            }
                            //For non string types empty match modes are not supported, so convert them to null match modes.
                            if (_.includes(DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES, filterCondition) && !_.includes(['text', 'string'], _.toLower(field.type))) {
                                filterCondition = DB_CONSTANTS.DATABASE_NULL_EMPTY_MATCH[filterCondition];
                            }
                            switch (filterCondition) {
                            case matchModes.in:
                                fieldValue = field.value.length ? '(' + _.join(_.map(field.value, function (val) {
                                    return getFieldValue(val, field.type);
                                }), ', ') + ')' : undefined;
                                break;
                            case matchModes.between:
                                fieldValue =  field.value.length ? _.join(_.map(field.value, function (val) {
                                    return getFieldValue(val, field.type);
                                }), ' and ') : undefined;
                                break;
                            default:
                                fieldValue = getFieldValue(field.value, field.type);
                            }
                            matchModeExpr  = DB_CONSTANTS.DATABASE_MATCH_MODES_WITH_QUERY[filterCondition];
                            param          = WM.isDefined(fieldValue) ? Utils.replace(matchModeExpr, [field.column, fieldValue]) : '';
                        }
                        if (param) {
                            whereParams.push(param);
                        }
                    });
                    whereClause = whereParams.length ? ' WHERE ' + _.join(whereParams, logicalOp) : '';
                } else if (!WM.element.isEmptyObject(options.filterFields)) {
                    whereClause = " WHERE ";
                    WM.forEach(options.filterFields, function (field, fieldName) {
                        var fieldValue;
                        if (WM.isArray(field.value)) {
                            if (field.filterCondition === 'BETWEEN') {
                                if (_.includes(dateTypes, field.type)) {
                                    fields[0] = "'" + moment(field.value[0]).format('YYYY-MM-DD HH:mm:ss') + "'";
                                    fields[1] = "'" + moment(field.value[1]).format('YYYY-MM-DD HH:mm:ss') + "'";
                                } else {
                                    fields = field.value;
                                }
                                whereClause += fieldName + ' BETWEEN ' + fields[0] + ' AND ' + fields[1] + logicalOp;
                            } else {
                                whereClause += "(" + fieldName + "='";
                                field.value.forEach(function (element, index) {
                                    if (index + 1 === field.value.length) {
                                        whereClause += element;
                                    } else {
                                        whereClause += element + "' OR " + fieldName + "='";
                                    }
                                });
                                whereClause += "')" + logicalOp;
                            }
                        } else {
                            /*Set appropriate value for fieldValue based on the type of data passed for the field.*/
                            if (!WM.isUndefined(field.value)) {
                                fieldValue = field.value;
                            } else if (!WM.isObject(field)) {
                                fieldValue = field;
                            } else {
                                return;
                            }
                            //In case of boolean field quotes should not be sent
                            if (field.type === 'boolean') {
                                whereClause += fieldName + "=" + fieldValue + " " + logicalOp;
                            } else {
                                whereClause += fieldName + "='" + fieldValue + "'" + logicalOp;
                            }
                        }
                    });
                    whereClause = whereClause.slice(0, logicalOpSliceLength);
                }
                groupByClause = options.groupby ? (" GROUP BY " + options.groupby) : "";
                orderByClause = options.orderby ? (" ORDER BY " + options.orderby) : "";

                query = selectClause + columnClause + fromClause + whereClause + groupByClause + orderByClause;

                return query;
            },
            'executeQuery': function (options, success, error) {
                var executeQuery = function () {
                    DatabaseService.executeCustomQuery({
                        "projectID": $rootScope.project.id,
                        "dataModelName": options.databaseName,
                        "page": options.page,
                        "size": options.size,
                        "data": {
                            "queryString": options.query,
                            "parameters" : options.queryParams || [],
                            "nativeSql"  : options.nativeSql,
                            'type'       : 'SELECT'
                        },
                        "service": options.prefabName ? "" : "services",
                        "url": options.prefabName ? ($rootScope.project.deployedUrl + "/prefabs/" + options.prefabName) : $rootScope.project.deployedUrl
                    }, function (response) {
                        if (response.errors) {
                            Utils.triggerFn(error, response);
                        } else {
                            Utils.triggerFn(success, response);
                        }
                    }, function (response) {
                        Utils.triggerFn(error, response);
                    });
                };
                /*If the project is not yet deployed,
                deploy the project and then execute the query.*/
                if (!$rootScope.project.deployedUrl) {
                    ProjectService.run({
                        projectId: $rootScope.project.id
                    }, function (result) {
                        /*Save the deployed url of the project in the $rootScope so that it could be used in all calls to services of deployed app*/
                        $rootScope.project.deployedUrl = Utils.removeProtocol(result);
                        executeQuery();
                    });
                } else {
                    executeQuery();
                }
            }
        };
    }
];