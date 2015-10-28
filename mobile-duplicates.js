var _ = require('lodash');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var Q = require('q');
var csv = require('csv');
var _debug = require('debug');

var debug = function(prefix) {
    var d = _debug(prefix);
    return function() {
        var args = Array.prototype.slice.call(arguments);
        return d.apply(void 0, [args.map(function() { return '%o'; }).join(" ")].concat(args));
    };
};

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

var keys = Object.keys(translations[BASE_LANGUAGE]).filter(function(key) { return ['NULL'].indexOf(key) === -1; });

languages.forEach(function(language) {
    var isMobile = language.match(/_mobile$/);
    var _language = isMobile ? language.substr(0, language.length - 7) : language;
    var filename = _language;

    if (isMobile) {
        // merge keys unknown in base file to base file
        Object.keys(translations[language]).forEach(function(key) {
            if (!translations[_language][key]) {
                translations[_language][key] = translations[language][key];
                delete translations[language][key];
                keys.push(key);
            }
        });

        //
        keys.forEach(function(key) {
            if (translations[_language][key] == translations[language][key]) {
                delete translations[language][key];
            }
        });

        var rawOriginal = fs.readFileSync((isMobile ? MOBILE_DIR : DIR) + "/" + filename + ".json").toString('utf8');
        var rowsOriginal = rawOriginal.split("\n");
        var commentLines = {};
        var blankLines = {}; // @TODO
        var comments = {};
        var skip = 0;

        _.forEach(rowsOriginal, function(row, idx) {
            if (skip > 0) {
                skip--;
                return;
            }

            var blankLine = row.match(/^\s*$/);
            var commentLine = row.match(/^( *?)\/\/(.+)/);
            var comment = row.match(/".+?[^\\]",(( *?)\/\/(.+))$/);

            debug('import-csv:parse-original')("-----------");
            debug('import-csv:parse-original')(row, !!blankLine, !!commentLine, !!comment);

            if (blankLine) {
                var beforeKey = null;

                _.any(rowsOriginal.slice(idx+1), function(nextRow, nextIdx) {
                    var key = nextRow.match(/^( +?)"(.+?)"( *?):/);

                    debug('import-csv:parse-original')(nextRow, !!commentLine, !!key);

                    if (key) {
                        beforeKey = key[2];

                        return true;
                    }
                });

                if (beforeKey) {
                    blankLines[beforeKey] = true;
                }

            } else if (commentLine) {
                var _commentLine = [commentLine[0]];
                var beforeKey = null;

                _.any(rowsOriginal.slice(idx+1), function(nextRow, nextIdx) {
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
                    commentLines[beforeKey] = _commentLine;
                }
            } else if (comment) {
                var key = row.match(/^( +?)"(.+?)"( *?):/);

                debug('import-csv:parse-original')(!!comment && comment[1], !!key && key[2]);

                if (key) {
                    comments[key[2]] = comment[1];
                }

            }
        });

        var json = JSON.stringify(translations[language], null, 4).split("\n");

        json.slice().forEach(function(line) {
            var key = line.match(/^( +?)"(.+?)"( *?):/);

            debug('import-csv:output')(line, !!key && key[2], !!key && typeof commentLines[key[2]] !== "undefined");

            if (!!key && blankLines[key[2]]) {
                json.splice(json.indexOf(line), 0, "");
            }

            if (!!key && commentLines[key[2]]) {
                commentLines[key[2]].reverse().forEach(function(comment) {
                    json.splice(json.indexOf(line), 0, comment);
                });
            }

            if (!!key && comments[key[2]]) {
                json.splice(json.indexOf(line), 1, line + comments[key[2]]);
            }
        });

        fs.writeFileSync(MOBILE_DIR + "/" + filename + ".json", json.join("\n") + "\n");

        var json = JSON.stringify(translations[_language], null, 4).split("\n");

        json.slice().forEach(function(line) {
            var key = line.match(/^( +?)"(.+?)"( *?):/);

            debug('import-csv:output')(line, !!key && key[2], !!key && typeof commentLines[key[2]] !== "undefined");

            if (!!key && blankLines[key[2]]) {
                json.splice(json.indexOf(line), 0, "");
            }

            if (!!key && commentLines[key[2]]) {
                commentLines[key[2]].reverse().forEach(function(comment) {
                    json.splice(json.indexOf(line), 0, comment);
                });
            }

            if (!!key && comments[key[2]]) {
                json.splice(json.indexOf(line), 1, line + comments[key[2]]);
            }
        });

        fs.writeFileSync(DIR + "/" + filename + ".json", json.join("\n") + "\n");
    }
});
