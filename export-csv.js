var _ = require('lodash');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var Q = require('q');
var csv = require('csv');

var BASE_LANGUAGE = "english";
var BLACKLIST = ['package.json'];
var DIR = __dirname + "/translations";
var MOBILE_DIR = DIR + "/mobile";

var translations = {};

fs.readdirSync(DIR).forEach(function(filename) {
    if (filename.match(/\.json$/) && BLACKLIST.indexOf(filename) === -1) {
        var language = filename.replace(/\.json$/, "");

        var raw = fs.readFileSync(DIR + "/" + filename);
        translations[language] = JSON.parse(stripJsonComments(raw.toString('utf8')));
    }
});

fs.readdirSync(MOBILE_DIR).forEach(function(filename) {
    if (filename.match(/\.json$/) && BLACKLIST.indexOf(filename) === -1) {
        var language = filename.replace(/\.json$/, "");

        var raw = fs.readFileSync(MOBILE_DIR + "/" + filename);
        translations[language + "_mobile"] = JSON.parse(stripJsonComments(raw.toString('utf8')));
    }
});

var languages = Object.keys(translations).sort();
// bring BASE_LANGUAGE to front
languages.splice(languages.indexOf(BASE_LANGUAGE), 1);
languages.unshift(BASE_LANGUAGE);

// put _mobile behind it's parent
_.forEach(languages, function(language, idx) {
    if (language.match(/_mobile$/)) {
        var _language = language.substr(0, language.length -7);

        languages.splice(languages.indexOf(language), 1);
        languages.splice(languages.indexOf(_language)+1, 0, language);
    }
});

var keys = Object.keys(translations[BASE_LANGUAGE]).filter(function(key) { return ['NULL'].indexOf(key) === -1; });

var rows = _.map(keys, function(key) {
    return [key].concat(_.map(languages, function(language) {
        return translations[language][key] || "";
    }));
});

rows.unshift(['KEY'].concat(languages));

rows = rows.map(function(row) {
    return row.map(function(v) {
        // in JSON we do multiline as ["line1", "line2"]
        if (typeof v !== "string") {
            v = v.join("\n");
        }

        return v;
    });
});

csv.stringify(rows, {delimiter: ";", quoted: true}, function(err, raw) {
    if (err) throw err;

    console.log(raw);
});
