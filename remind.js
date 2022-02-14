"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var axios_1 = __importDefault(require("axios"));
var fs_1 = require("fs");
var ical = require("node-ical");
var moment_1 = __importDefault(require("moment"));
moment_1["default"].locale('de');
var markdown_escape_1 = __importDefault(require("markdown-escape"));
var path_1 = __importDefault(require("path"));
var yaml_1 = __importDefault(require("yaml"));
var store = require('data-store')({
    path: path_1["default"].join(__dirname, 'remember.json')
});
var subscriptionsFile = path_1["default"].join(__dirname, 'subscriptions.yaml');
var subscriptions = yaml_1["default"].parse((0, fs_1.readFileSync)(subscriptionsFile, 'utf8'));
var configFile = path_1["default"].join(__dirname, 'config.yaml');
var config = yaml_1["default"].parse((0, fs_1.readFileSync)(configFile, 'utf8'));
var showEvent = /** @class */ (function () {
    function showEvent(event, startDate, endDate) {
        this.allDay = false;
        this.summary = (typeof (event.summary) === "string")
            ? event.summary : event.summary.val;
        if (event.url) {
            this.url = (typeof (event.url) === "string")
                ? event.url : event.url.val;
        }
        if (event.location) {
            this.location = (typeof (event.location) === "string")
                ? event.location : event.location.val;
        }
        if (event.description) {
            this.description = (typeof (event.description) === "string")
                ? event.description : event.description.val;
        }
        this.start = startDate;
        this.end = endDate;
    }
    showEvent.prototype.rememberBy = function () {
        return "".concat(this.summary, " ").concat(this.start);
    };
    return showEvent;
}());
var process = function (event, subscription) {
    var message = [
        "**".concat((0, markdown_escape_1["default"])(event.summary, ['slashes']), "**"),
        "".concat(event.start.format("H:mm"), "\u2013").concat(event.end.format("H:mm")) +
            (event.location ? " | ".concat((0, markdown_escape_1["default"])(event.location, ['slashes'])) : '') +
            (event.url ? " | ".concat(event.url) : '') +
            (event.description ? "\n\n".concat((0, markdown_escape_1["default"])(event.description, ['slashes'])) : ''),
        "\n*Dieser Termin begint ".concat(event.start.fromNow(), ".*")
    ].join('\n');
    subscription.channels.forEach(function (channel) {
        if (!config.production) {
            channel == "bot-sandbox";
        }
        var remembered = store.get(channel) || [];
        if (remembered.includes(event.rememberBy())) {
            return;
        }
        if (config.log) {
            console.log(channel, message);
            if (config.save) {
                store.union(channel, event.rememberBy());
            }
        }
        if (config.post) {
            axios_1["default"].post(config.webhookURL, {
                text: message,
                channel: channel,
                username: config.username,
                icon_url: config.iconURL
            })
                .then(function (_) {
                if (config.save) {
                    store.union(channel, event.rememberBy());
                }
            });
        }
    });
};
// What period are we even interested in?
var rangeStart = (0, moment_1["default"])().startOf('day');
var rangeEnd = (0, moment_1["default"])(rangeStart).add(3, 'd');
subscriptions.forEach(function (subscription) {
    var showEvents = new Array();
    var readEvents = ical.sync.parseFile(path_1["default"].join(__dirname, "cache/".concat(subscription.name, ".ics")));
    var _loop_1 = function (k) {
        if (!Object.prototype.hasOwnProperty.call(readEvents, k))
            return "continue";
        var event_1 = readEvents[k];
        // Metadata or something
        if (event_1.type !== 'VEVENT')
            return "continue";
        var startDate = (0, moment_1["default"])(event_1.start);
        var endDate = (0, moment_1["default"])(event_1.end);
        var duration = parseInt(endDate.format("x"))
            - parseInt(startDate.format("x"));
        var dates = void 0;
        if (event_1.rrule) {
            // Get dates of interest within rrule
            dates = event_1.rrule.between(rangeStart.toDate(), rangeEnd.toDate(), true, function (_date, _i) { return true; }).map(function (d) { return (0, moment_1["default"])(d); });
            // Add all manually changed recurrences that were not originally in range
            if (event_1.recurrences != undefined) {
                for (var r in event_1.recurrences) {
                    if ((0, moment_1["default"])(new Date(r)).isBetween(rangeStart, rangeEnd) != true) {
                        dates.push((0, moment_1["default"])(new Date(r)));
                    }
                }
            }
            dates.forEach(function (date) {
                var curEvent = event_1;
                var showRecurrence = true;
                var curDuration = duration;
                var startDate = date;
                var dateLookupKey = date.toISOString().substring(0, 10);
                if ((curEvent.recurrences != undefined)
                    && (curEvent.recurrences[dateLookupKey] != undefined)) {
                    // We found an override, so for this recurrence, use a potentially
                    // different title, start date, and duration.
                    curEvent = curEvent.recurrences[dateLookupKey];
                    startDate = (0, moment_1["default"])(curEvent.start);
                    curDuration = parseInt((0, moment_1["default"])(curEvent.end).format("x"))
                        - parseInt(startDate.format("x"));
                }
                // remove exceptions
                else if ((curEvent.exdate != undefined) && (curEvent.exdate[dateLookupKey] != undefined)) {
                    showRecurrence = false;
                }
                // Set the the title and the end date from either the regular event or the recurrence override.
                endDate = (0, moment_1["default"])(parseInt(startDate.format("x")) + curDuration, 'x');
                if (endDate.isBefore(rangeStart) || startDate.isAfter(rangeEnd)) {
                    showRecurrence = false;
                }
                if (showRecurrence) {
                    showEvents.push(new showEvent(curEvent, startDate, endDate));
                }
            });
        }
        else {
            showEvents.push(new showEvent(event_1, startDate, endDate));
        }
    };
    for (var k in readEvents) {
        _loop_1(k);
    }
    showEvents
        .filter(function (e) { return e.start.isBetween((0, moment_1["default"])(), (0, moment_1["default"])().add(15, 'minutes')); })
        .forEach(function (e) { return process(e, subscription); });
});
