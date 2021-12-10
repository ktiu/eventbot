"use strict";
exports.__esModule = true;
var fs_1 = require("fs");
var ical = require("node-ical");
var moment = require("moment");
var path = require("path");
var yaml = require("yaml");
var subscriptionsFile = path.join(__dirname, 'subscriptions.yaml');
var subscriptions = yaml.parse((0, fs_1.readFileSync)(subscriptionsFile, 'utf8'));
var store = require('data-store')({ path: path.join(__dirname, 'storage/reminded.json') });
var Event = /** @class */ (function () {
    function Event(event, date) {
        this.allDay = false;
        console.log(typeof (event.summary));
        this.summary = (typeof (event.summary) === "string")
            ? event.summary : event.summary.val;
        this.start = date;
    }
    Event.prototype.toString = function () {
        return this.summary;
    };
    return Event;
}());
var events = [];
subscriptions.forEach(function (subscription) {
    console.log("\n\nCALENDAR NAME:", subscription.name);
    var readEvents = ical.sync.parseFile("cache/".concat(subscription.name, ".ics"));
    var _loop_1 = function (k) {
        if (!Object.prototype.hasOwnProperty.call(readEvents, k))
            return "continue";
        var event_1 = readEvents[k];
        if (event_1.type !== 'VEVENT')
            return "continue";
        var dates = void 0;
        if (event_1.rrule) {
            dates = event_1.rrule.between(new Date(2021, 0, 1, 0, 0, 0, 0), new Date(2021, 12, 31, 0, 0, 0, 0));
            //TODO
        }
        else {
            dates = [event_1.start];
        }
        dates.forEach(function (date) {
            events.push(new Event(event_1, date));
        });
    };
    for (var k in readEvents) {
        _loop_1(k);
    }
});
console.log(events);
