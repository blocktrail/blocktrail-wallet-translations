var _ = require('lodash');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var Q = require('q');
var csv = require('csv');
var _debug = require('debug');

_debug.enable('import-csv:errors');

String.prototype.sentenceCase = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

var debug = function(prefix) {
    var d = _debug(prefix);
    return function() {
        var args = Array.prototype.slice.call(arguments);
        return d.apply(void 0, [args.map(function() { return '%o'; }).join(" ")].concat(args));
    };
};

// the BASE_LANGUAGE is used to determine which keys should be present
var BASE_LANGUAGE = "english";
var BLACKLIST = ['package.json'];
var DIR = __dirname + "/translations";
var MOBILE_DIR = DIR + "/mobile";
var SENTENCE_CASE = false;

// store all translations in here before writing to .json files
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

// read and parse the CSV file
var raw = fs.readFileSync(__dirname + "/translations.csv").toString('utf8');
csv.parse(raw, {delimiter: ";", columns: true}, function(err, data) {
    if (err) throw err;

    // process rows
    data.forEach(function(row) {
        // check each language
        languages.forEach(function(language) {
            // check if this row has a translation for this language
            if (row[language]) {
                // if it contains newlines we split it on
                if (row[language].match(/\n/)) {
                    row[language] = row[language].replace(/\r\n/, '\n'); // windows to unix newlines
                    row[language] = row[language].split(/\n/);
                }

                if (SENTENCE_CASE) {
                    if (_.isArray(row[language])) {
                        row[language] = row[language].map(function(line) {
                            return line.sentenceCase();
                        });
                    } else {
                        row[language] = row[language].sentenceCase();
                    }
                }

                // only store translations of which the keys are known (in BASE_LANGUAGE)
                if (keys.indexOf(row.KEY) !== -1) {
                    translations[language][row.KEY] = row[language];
                } else {
                    debug('import-csv:errors')("key [" + row.KEY + "] not in BASE_LANGUAGE");
                }
            }
        });
    });

    // process comments and blank lines from BASE_LANGUAGE so we can apply them to the other files as well
    var commentLines = {};
    var blankLines = {};
    var comments = {};
    [true, false].forEach(function(isMobile) {
        var rawOriginal = fs.readFileSync((isMobile ? MOBILE_DIR : DIR) + "/" + BASE_LANGUAGE + ".json").toString('utf8');
        var rowsOriginal = rawOriginal.split("\n");
        var _commentLines = commentLines[isMobile] = {};
        var _blankLines = blankLines[isMobile] = {};
        var _comments = comments[isMobile] = {};
        var skip = 0;

        // process the original file for blank lines and comments so we can apply them back into the new JSON file
        _.forEach(rowsOriginal, function(row, idx) {
            if (skip > 0) {
                skip--;
                return;
            }

            var blankLine = row.match(/^\s*$/);
            var commentLine = row.match(/^( *?)\/\/(.+)/);
            var comment = row.match(/".+?[^\\]",(( *?)\/\/(.+))$/);
            var beforeKey;

            debug('import-csv:parse-original')("-----------");
            debug('import-csv:parse-original')(row, !!blankLine, !!commentLine, !!comment);

            if (blankLine) {
                beforeKey = null;

                _.any(rowsOriginal.slice(idx + 1), function(nextRow, nextIdx) {
                    var key = nextRow.match(/^( +?)"(.+?)"( *?):/);

                    debug('import-csv:parse-original')(nextRow, !!commentLine, !!key);

                    if (key) {
                        beforeKey = key[2];

                        return true;
                    }
                });

                if (beforeKey) {
                    _blankLines[beforeKey] = true;
                }

            } else if (commentLine) {
                var _commentLine = [commentLine[0]];
                beforeKey = null;

                _.any(rowsOriginal.slice(idx + 1), function(nextRow, nextIdx) {
                    var commentLine = nextRow.match(/^( *)\/\/(.+)/);
                    var key = nextRow.match(/^( +?)"(.+?)"( *?):/);

                    debug('import-csv:parse-original')(nextRow, !!commentLine, !!key);

                    if (key) {
                        beforeKey = key[2];

                        return true;
                    } else if (commentLine) {
                        _commentLine.push(commentLine[0]);
                        skip++;
                    } else {
                        debug('import-csv:parse-original')('WHAT IS THIS?', nextRow);
                    }
                });

                debug('import-csv:parse-original')(_commentLine);
                if (beforeKey) {
                    _commentLines[beforeKey] = _commentLine;
                }
            } else if (comment) {
                var key = row.match(/^( +?)"(.+?)"( *?):/);

                debug('import-csv:parse-original')(!!comment && comment[1], !!key && key[2]);

                if (key) {
                    _comments[key[2]] = comment[1];
                }

            }
        });
    });

    // store each language
    languages.forEach(function(language) {
        var isMobile = !!language.match(/_mobile$/);
        var filename = isMobile ? language.substr(0, language.length -7) : language;

        var _commentLines = commentLines[isMobile];
        var _blankLines = blankLines[isMobile];
        var _comments = comments[isMobile];

        // create new JSON file
        var json = JSON.stringify(translations[language], null, 4).split("\n");

        // apply comments and blank lines to new JSON file
        json.slice().forEach(function(line) {
            var key = line.match(/^( +?)"(.+?)"( *?):/);

            debug('import-csv:output')(line, !!key && key[2], !!key && typeof _commentLines[key[2]] !== "undefined");

            if (!!key && _blankLines[key[2]]) {
                json.splice(json.indexOf(line), 0, "");
            }

            if (!!key && _commentLines[key[2]]) {
                _commentLines[key[2]].reverse().forEach(function(comment) {
                    json.splice(json.indexOf(line), 0, comment);
                });
            }

            if (!!key && _comments[key[2]]) {
                json.splice(json.indexOf(line), 1, line + _comments[key[2]]);
            }
        });

        // save
        fs.writeFileSync((isMobile ? MOBILE_DIR : DIR) + "/" + filename + ".json", json.join("\n") + "\n");
    });
});
