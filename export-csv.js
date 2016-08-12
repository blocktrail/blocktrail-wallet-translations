var _ = require('lodash');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var Q = require('q');
var csv = require('csv');

// the BASE_LANGUAGE is used to determine which keys should be present
var BASE_LANGUAGE = "english";
var BLACKLIST = ['package.json'];
var DIR = __dirname + "/translations";
var MOBILE_DIR = DIR + "/mobile";

// store all translations in here before writing to .csv file
var translations = {};

// read existing translation files
fs.readdirSync(DIR).forEach(function(filename) {
    if (filename.match(/\.json$/) && BLACKLIST.indexOf(filename) === -1) {
        var language = filename.replace(/\.json$/, "");

        var raw = fs.readFileSync(DIR + "/" + filename);
        translations[language] = JSON.parse(stripJsonComments(raw.toString('utf8')));
    }
});

// read existing translation files for mobile
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

// determine keys based on BASE_LANGUAGE
var keys = Object.keys(translations[BASE_LANGUAGE]).filter(function(key) { return ['NULL'].indexOf(key) === -1; });

// create row for each key
var rows = _.map(keys, function(key) {
    return [key].concat(_.map(languages, function(language) {
        return translations[language][key] || ""; // translation or blank
    }));
});

// add the headers row
rows.unshift(['KEY'].concat(languages));

// process rows before creating CSV
rows = rows.map(function(row) {
    return row.map(function(v) {
        // in JSON we do multiline as ["line1", "line2"] so we join arrays with newline
        if (typeof v !== "string") {
            v = v.join("\n");
        }

        return v;
    });
});

// create CSV output
csv.stringify(rows, {delimiter: ";", quoted: true}, function(err, raw) {
    if (err) throw err;

    console.log(raw);
});
