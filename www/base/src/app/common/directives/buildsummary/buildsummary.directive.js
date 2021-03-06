/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class Buildsummary {
    constructor(RecursionHelper) {
        return {
            replace: true,
            restrict: 'E',
            scope: {},
            bindToController: {buildid: '=?', build: '=?', condensed: '=?', parentbuild: '=?', parentrelationship: '=?'},
            templateUrl: 'views/buildsummary.html',
            compile: RecursionHelper.compile,
            controller: '_buildsummaryController',
            controllerAs: 'buildsummary'
        };
    }
}

class _buildsummary {
    constructor($scope, dataService, resultsService, buildersService, $urlMatcherFactory, $location, $interval, RESULTS, bbSettingsService) {
        const self = this;
        // make resultsService utilities available in the template
        _.mixin($scope, resultsService);

        const baseurl = $location.absUrl().split("#")[0];
        const buildrequestURLMatcher = $urlMatcherFactory.compile(
            `${baseurl}#buildrequests/{buildrequestid:[0-9]+}`);
        const buildURLMatcher = $urlMatcherFactory.compile(
            `${baseurl}#builders/{builderid:[0-9]+}/builds/{buildid:[0-9]+}`);
        // to get an update of the current builds every seconds, we need to update self.now
        // but we want to stop counting when the scope destroys!
        const stop = $interval(() => {
            this.now = moment().unix();
        }
        , 1000);
        $scope.$on("$destroy", () => $interval.cancel(stop));
        $scope.settings = bbSettingsService.getSettingsGroup("LogPreview");

        const NONE = 0;
        const ONLY_NOT_SUCCESS = 1;
        const EVERYTHING = 2;
        let details = EVERYTHING;
        if ($scope.buildsummary.condensed) {
            details = NONE;
        }
        this.toggleDetails = () => details = (details + 1) % 3;

        this.levelOfDetails = function() {
            switch (details) {
                case NONE:
                    return "None";
                case ONLY_NOT_SUCCESS:
                    return "Problems";
                case EVERYTHING:
                    return "All";
            }
        };

        this.isStepDisplayed = function(step) {
            if (details === EVERYTHING) {
                return !step.hidden;
            } else if (details === ONLY_NOT_SUCCESS) {
                return (step.results == null) || (step.results !== RESULTS.SUCCESS);
            } else if (details === NONE) {
                return false;
            }
        };

        this.getBuildRequestIDFromURL = url => parseInt(buildrequestURLMatcher.exec(url).buildrequestid, 10);

        this.isBuildRequestURL = url => buildrequestURLMatcher.exec(url) !== null;

        this.isBuildURL = url => buildURLMatcher.exec(url) !== null;

        this.getBuildProperty = function(property) {
            const hasProperty = self.properties && self.properties.hasOwnProperty(property);
            if (hasProperty) { return self.properties[property][0]; } else { return null; }
        };

        this.isSummaryLog = log => log.name.toLowerCase() === "summary";

        this.expandByName = function(log) {
            let needle;
            return (log.num_lines > 0) && (needle = log.name.toLowerCase(), Array.from($scope.settings.expand_logs.value.toLowerCase().split(";")).includes(needle));
        };

        // Returns the logs, sorted with the "Summary" log first, if it exists in the step's list of logs
        this.getLogs = function(step) {
            const summaryLogs = step.logs.filter(log => this.isSummaryLog(log));
            const logs = summaryLogs.concat( step.logs.filter(log => !this.isSummaryLog(log)) );
            return logs;
        };


        this.toggleFullDisplay = function() {
            this.fulldisplay = !this.fulldisplay;
            if (this.fullDisplay) {
                details = EVERYTHING;
            }
            return Array.from(this.steps).map((step) =>
                (step.fulldisplay = this.fulldisplay));
        };

        const data = dataService.open().closeOnDestroy($scope);
        $scope.$watch((() => this.buildid), function(buildid) {
            if ((buildid == null)) { return; }
            return data.getBuilds(buildid).onNew = build => self.build = build;
        });

        $scope.$watch((() => this.build), function(build) {
            if ((build == null)) { return; }
            if (self.builder) { return; }
            self.builder = buildersService.getBuilder(build.builderid);

            build.getProperties().onNew = function(properties) {
                self.properties = properties;
                return self.reason = self.getBuildProperty('reason');
            };

            return $scope.$watch((() => details), function(details) {
                if ((details !== NONE) && (self.steps == null)) {
                    self.steps = build.getSteps();

                    self.steps.onNew = function(step) {
                        step.logs = step.getLogs();
                        // onUpdate is only called onUpdate, not onNew
                        // but we need to update our additional needed attributes
                        return self.steps.onUpdate(step);
                    };

                    return self.steps.onUpdate = function(step) {
                        step.fulldisplay = (step.complete === false) || (step.results > 0);
                        if (step.complete) {
                            return step.duration = step.complete_at - step.started_at;
                        }
                    };
                }
            });
        });
        $scope.$watch((() => this.parentbuild), function(build,o) {
            if ((build == null)) { return; }
            return self.parentbuilder = buildersService.getBuilder(build.builderid);
        });
    }
}


angular.module('common')
.directive('buildsummary', ['RecursionHelper', Buildsummary])
.controller('_buildsummaryController', ['$scope', 'dataService', 'resultsService', 'buildersService', '$urlMatcherFactory', '$location', '$interval', 'RESULTS', 'bbSettingsService', _buildsummary]);
