"use strict";
exports.__esModule = true;
var axios_1 = require("axios");
var fs_1 = require("fs");
// const store = require('data-store')({ path: path.join(__dirname, 'storage/read.json')})
var path = require('path');
var yaml = require('yaml');
var store = require('data-store')({ path: path.join(__dirname, 'storage/read.json') });
var subscriptionsFile = path.join(__dirname, 'subscriptions.yaml');
var subscriptions = yaml.parse((0, fs_1.readFileSync)(subscriptionsFile, 'utf8'));
var syncCache = function (subscription) {
    (0, axios_1["default"])({
        url: subscription.url,
        method: 'GET',
        responseType: 'stream'
    }).then(function (response) {
        response.data.pipe((0, fs_1.createWriteStream)("cache/".concat(subscription.name, ".ics")));
    })["catch"](function (error) {
        if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        }
        else if (error.request) {
            console.log(error.request);
        }
        else {
            console.log('Error', error.message);
        }
    });
};
subscriptions.forEach(function (s) { return syncCache(s); });
