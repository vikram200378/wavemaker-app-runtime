/*global WM, wm, document, _*/
/*Directive for prefabs */

WM.module('wm.prefabs')
/**
 * @ngdoc directive
 * @name wm.prefab.directive:wmPrefabContainer
 * @restrict E
 * @element ANY
 */
    .directive('wmPrefabContainer', ['$rootScope', 'Variables',
        function ($rootScope, Variables) {
            'use strict';

            return {
                'restrict': 'E',
                'replace' : true,
                'transclude' : true,
                'template': '<div class="app-prefab-container" wmtransclude></div>',
                link: {
                    pre: function($s) {
                        // register the page variables for prefab (not putting studio mode check here as it is 10.x studio code only)
                        // done only for prefab project and not for prefab in app (as that is handled by wm-prefab directive)
                        if($rootScope.isPrefabTemplate && !$s.name) {
                            var pageName = "Main";
                            Variables.getPageVariables(pageName, function (variables) {
                                Variables.register(pageName, variables, true, $s);
                            });
                        }
                    }
                }
            };
        }
    ]);
