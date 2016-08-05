# BTC Wallet Translations
This repo contains JSON files with all translations used for the BTC.com Web and Mobile Wallet.  
The scripts to convert from JSON -> CSV -> JSON are horrific right now, but they do what they're supposed to, will be cleaned up at a later stage ...

## Structure
`translations/*.json` are the main translation files, they're used in the Web Wallet.  
`translations/mobile/*.json` are merged over the main translation files for the Mobile Wallet, this is mainly for button text etc. that is otherwise too big to fit.

## Install
```
npm install
```

## Create CSV to translate in Libre Calc / MS Excel
```
node export-csv.js > translations.csv
```

## Import CSV with changes back into the JSON files
```
# asumes translations.csv is in the root dir
node import-csv.js
```

## RegEx used for converting JS files to JSON
`  ([A-Z].+): ?["'](.+)['"],` `"$1": "$2",`

## License
The BTC Wallet source code is released under the GNU Affero General Public License.  
The BTC.com Logo and any other images / graphics are not part of this.  
See [LICENSE.md](LICENSE.md).
