/*global WM, _ */
/*jslint todo: true */
/*Directive for Accordion */
WM.module('wm.layouts.containers')
    .run(['$templateCache', function ($templateCache) {
        'use strict';

        $templateCache.put('template/layout/container/accordion.html', '<div class="app-accordion panel-group" wmtransclude init-widget apply-styles="scrollable-container"></div>');

        $templateCache.put('template/layout/container/accordion-pane.html',
            '<div class="app-accordion-panel panel" page-container init-widget wm-navigable-element="true" apply-styles="shell">' +
                '<div class="panel-heading clearfix" ng-click="togglePane($event)" ng-class="{active: isActive}">' +
                    '<h3 class="panel-title">' +
                        '<a href="javascript:void(0);" class="accordion-toggle">' +
                            '<div class="pull-left"><i class="app-icon panel-icon {{iconclass}}" ng-show="iconclass"></i></div>' +
                            '<div class="pull-left"><div class="heading" ng-bind-html="title"></div>' +
                            '<div class="description" ng-bind-html="subheading"></div></div>' +
                        '</a>' +
                    '</h3>' +
                    '<div class="panel-actions"><span class="label label-{{badgetype}}">{{badgevalue}}</span><button type="button" class="app-icon wi panel-action" title="{{::$root.appLocale.LABEL_COLLAPSE}}/{{::$root.appLocale.LABEL_EXPAND}}" ng-class="isActive ? \'wi-minus\': \'wi-plus\'"></button></div>' +
                '</div>' +
                '<div class="panel-collapse collapse"  ng-class="isActive ? \'collapse in\' : \'collapse\'">' +
                    '<div class="panel-body" wm-smoothscroll="{{smoothscroll}}" wmtransclude page-container-target apply-styles="inner-shell"></div>' +
                '</div>' +
            '</div>'
            );
    }])
    .directive('wmAccordion', ['$templateCache', 'WidgetUtilService', 'PropertiesFactory', 'Utils', function ($templateCache, WidgetUtilService, PropertiesFactory, Utils) {
        'use strict';

        var widgetProps = PropertiesFactory.getPropertiesOf('wm.accordion', ['wm.base', 'wm.layouts.panel.defaults']),
            notifyFor   = {
                'defaultpaneindex': true
            };

        /*Define the property change handler. This function will be triggered when there is a change in the widget property */
        function propertyChangeHandler(scope, key, newVal) {
            switch (key) {
            case 'defaultpaneindex':
            //If no activepane is set ie.. no isdefaultpane then honor defaultpaneindex
                if (!scope.activePane) {
                    scope.activePane = scope.panes[newVal || 0];
                }
                scope.activePane.expand();

                break;
            }
        }

        return {
            'restrict': 'E',
            'replace': true,
            'scope': {},
            'transclude': true,
            'template': $templateCache.get('template/layout/container/accordion.html'),
            'controller': function ($scope) {
                /* Contains the isolateScopes of accordion-panes. */
                $scope.panes     = [];
                this.paneIndex = 0;

                /* save the scope of the accordion-pane */
                this.register = function (paneScope) {
                    $scope.panes.push(paneScope);
                    paneScope.paneId = this.paneIndex;
                    this.paneIndex++;
                };

                /* function to collapse the accordion-panes */
                this.closeOthers = function () {
                    /* process the request only when closeothers attribute is present on accordion */
                    if ($scope.closeothers) {
                        WM.forEach($scope.panes, function (pane) {
                            if (pane.isActive) {
                                /* trigger the onCollapse method on the pane which is about to be collapsed */
                                Utils.triggerFn(pane.onCollapse);
                            }
                            /* update the `active` flag of the pane */
                            pane.isActive = false;
                        });
                    }
                };
            },
            'compile': function () {
                return {
                    'pre': function (scope, $el, attrs) {
                        scope.widgetProps = attrs.widgetid ? Utils.getClonedObject(widgetProps) : widgetProps;
                    },
                    'post': function (scope, element, attrs) {

                        _.forEach(scope.panes, function (pane) {
                            if (pane.isdefaultpane && !attrs.defaultpaneindex) {
                                scope.activePane = pane;
                            }
                        });

                        /* register the property change handler */
                        WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, scope), scope, notifyFor);

                        WidgetUtilService.postWidgetCreate(scope, element, attrs);
                    }
                };
            }
        };
    }])
    .directive('wmAccordionpane', ['$templateCache', 'WidgetUtilService', 'PropertiesFactory', 'Utils', 'CONSTANTS', function ($templateCache, WidgetUtilService, PropertiesFactory, Utils, CONSTANTS) {
        'use strict';

        var widgetProps = PropertiesFactory.getPropertiesOf('wm.accordionpane', ['wm.base', 'wm.scrollablecontainer']);

        return {
            'restrict': 'E',
            'replace': true,
            'scope': {},
            'transclude': true,
            'template': $templateCache.get('template/layout/container/accordion-pane.html'),
            'require': '^wmAccordion',
            'compile': function () {
                return {
                    'pre': function (scope, element, attrs) {
                        if (attrs.heading && !attrs.title) {
                            attrs.title = attrs.heading;
                        }

                        scope.widgetProps = attrs.widgetid ? Utils.getClonedObject(widgetProps) : widgetProps;

                        scope.$lazyLoad   = WM.noop;
                        element.removeAttr('title');
                    },
                    'post': function (scope, element, attrs, panesCtrl) {

                        var parentScope = element.closest('.app-accordion').isolateScope();

                        //To support backward compatibility for old projects
                        if (scope.title === undefined && !scope.bindtitle) {
                            scope.title = scope.heading || scope.bindheading;
                        }
                        /* register accordion-pane with accordion */
                        panesCtrl.register(scope);

                        /* toggle the state of the pane */
                        scope.togglePane = function ($event) {
                            /* flip the active flag */
                            var flag = !scope.isActive;

                            if (flag) {
                                /* some widgets like charts needs to be redrawn when a accordion pane becomes active for the first time */
                                element.find('.ng-isolate-scope')
                                    .each(function () {
                                        Utils.triggerFn(WM.element(this).isolateScope().redraw);
                                    });

                                if (!scope.widgetid && parentScope.onChange && $event) {
                                    parentScope.onChange({'$event': $event, '$scope': parentScope, 'newPaneIndex': scope.paneId, 'oldPaneIndex': (parentScope.activePane && parentScope.activePane.paneId) || 0});
                                }

                                parentScope.activePane = scope;

                                // when pane content is set to display external page, triggering $lazyLoad on expand of the accordion pane will render the content.
                                Utils.triggerFn(scope.$lazyLoad);
                                /* trigger the onExpand call back */
                                Utils.triggerFn(scope.onExpand);
                                panesCtrl.closeOthers(scope);
                            } else {
                                /* trigger the onCollapse callback */
                                Utils.triggerFn(scope.onCollapse);
                            }

                            scope.isActive = flag;
                        };

                        /* Expose the method `expand` on pane. Triggering this method will expand the pane. */
                        scope.expand = function () {
                            if (!scope.isActive) {
                                scope.togglePane();
                            }
                        };

                        /* Expose the method `collapse` on pane. Triggering this method will collapse the pane. */
                        scope.collapse = function () {
                            if (scope.isActive) {
                                scope.togglePane();
                            }
                        };
                        WidgetUtilService.postWidgetCreate(scope, element, attrs);
                    }
                };
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmAccordion
 * @restrict E
 *
 * @description
 * The `wmAccordion` directive defines accordion widget. <br>
 * wmAccordion can only contain wmAccordionpane widgets. <br>
 * wmAccordion can not be inside wmAccordion. <br>
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} name
 *                  Name of the accordion.
 * @param {string=} tabindex
 *                  The tabindex attribute specifies the tab order of an element.
 * @param {string=} width
 *                  Width of the accordion.
 * @param {string=} height
 *                  Height of the accordion.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the accordion on the web page. <br>
 *                  default value: `true`.
 * @param {boolean=} closeothers
 *                  True value for closeothers property will collapse the panes that are expanded on expand of a pane. <br>
 *                  False value for closeothers property will not collapse the expaneded panes on expand of a pane. <br>
 *                  Default value: `true`.
 * @param {number=} defaultpaneindex
 *                  Makes the pane active for given index.This property has backward compatibility for isdefaultpane property. </br>
 *                  Default value: 0
 * @param {string=} on-change
 *                  Callback function which will be triggered when the widget value is changed.
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div ng-controller="Ctrl" class="wm-app">
                <wm-accordion width="400px" height="400px" closeothers="false" horizontalalign='right'>
                    <wm-accordionpane title="pane1">
                        Content for pane1
                    </wm-accordionpane>
                    <wm-accordionpane title="pane2">
                        Content for pane2
                    </wm-accordionpane>
                </wm-accordion>
            </div>
        </file>
        <file name="script.js">
            function Ctrl($scope) {}
        </file>
    </example>
 */


/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmAccordionpane
 * @restrict E
 *
 * @description
 * The `wmAccordionpane` directive defines accordion-pane widget. <br>
 * wmAccordionpane can be used only inside wmAccordion. <br>
 * wmAccordionpane can not be inside wmAccordionpane. <br>
 * accordion-pane can be expanded/collapsed using the scope methods expand/collapse respectively.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} name
 *                  Name of the accordionpane.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the accordion on the web page. <br>
 *                  Default value: `true`.
 * @param {string=} title
 *                  Title of the header. <br>
 *                  This property is bindable. <br>
 *                  Default value: `Title`. <br>
 *                  This is will be used only when the default template is used.
 * @param {string=} subheading
 *                  subheading of the accordion header. <br>
 *                  This is will be used only when the default template is used.
 * @param {string=} iconclass
 *                  Icon which we displayed on the header. <br>
 *                  This property is bindable. <br>
 *                  This is will be used only when the default template is used.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the accordion on the web page. <br>
 *                  Default value: `true`.
 * @param {string=} horizontalalign
 *                  Align the content of the accordion-header to left/right/center. <br>
 *                  Default value: `left`.
 * @param {string=} on-expand
 *                  Callback function which will be triggered when the pane is expanded.
 * @param {string=} on-collapse
 *                  Callback function which will be triggered when the pane is collapsed.
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div ng-controller="Ctrl" class="wm-app">
                <wm-accordion>
                    <wm-accordionpane on-expand="expandCallback()" on-collapse="collapseCallback()" heading="pane1">
                        Content for pane1
                    </wm-accordionpane>
                    <wm-accordionpane heading="pane2">
                        Content for pane2
                    </wm-accordionpane>
                </wm-accordion>
            </div>
        </file>
        <file name="script.js">
            function Ctrl($scope) {
                $scope.expandCallback = function () {
                    console.log("inside expand callback");
                }
                $scope.collapseCallback = function () {
                    console.log("inside collapse callback");
                }
            }
        </file>
    </example>
 */
