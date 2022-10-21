const nwPath = require("path");
const fs = require("fs");
const csv = require('csv-parser');

const origText              = "materials/orig-test.txt";
const translatedText        = "materials/translated-test.txt";

// result file
const resultOrigFile        = "materials/result-orig.txt";
const resultTransFile       = "materials/result-translated.txt";

// dictionary file, containing japanese to english value in csv 
const dictionary            = "materials/dict.csv";
const config = [
    {
        markers: ["\ue101", "\ue102", "\ue103"],
        afterSentence : true,
        beforeSentence : true,
        placement : "after"
    }
]

const readCsv = async function(file) {
    var csvData=[];
    return new Promise((resolve, reject) => {
        fs.createReadStream(file)
        .pipe(csv())
        .on('data', function(data){
            try {
                csvData.push(data);
            } catch(err) {
                //error handler
            }
        })
        .on('end',function(){
            resolve(csvData);
        }); 
    })
}

function getCombinations(valuesArray = []) {

    var combi = [];
    var temp = [];
    var slent = Math.pow(2, valuesArray.length);

    for (var i = 0; i < slent; i++)
    {
        temp = [];
        for (var j = 0; j < valuesArray.length; j++)
        {
            if ((i & Math.pow(2, j)))
            {
                temp.push(valuesArray[j]);
            }
        }
        if (temp.length > 0)
        {
            combi.push(temp);
        }
    }

    combi.sort((a, b) => a.length - b.length);
    //console.log(combi.join("\n"));
    return combi;
}

const countOccurance = function(haystack, needle) {
    return haystack.split(needle).length -1
}

const countOccuranceArray = function(haystack, needle) {
    var count = 0;
    for (var i in haystack) {
        if (haystack[i] == needle) count++
    }
    return count;
}

const countOccuranceEn = function(haystack, needle) {
    if (needle.split(" ") > 1) {
        return countOccurance(haystack.toLowerCase(), needle.toLowerCase());
    }
    else return countOccuranceArray(splitByCommonToken(haystack.toLowerCase()), needle.toLowerCase());

}

const isMatchInsensitive = function(haystack, needle) {
    haystack = haystack.toLowerCase();
    if (needle.split(" ")>1) {
        return haystack.toLowerCase().includes(needle.toLowerCase());
    }
    return splitByCommonToken(haystack).includes(needle.toLowerCase())
}

const splitByCommonToken = function(str="") {
    return str.split(/[ \-\.\,\[\]\/\"]/);
}

String.prototype.replaceAllInsensitive = function(strReplace, strWith) {
    // See http://stackoverflow.com/a/3561711/556609
    var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    var reg = new RegExp(esc, 'ig');
    return this.replace(reg, strWith);
};

const clone = function(obj) {
    return JSON.parse(JSON.stringify(obj))
}

void async function() {
    var dict = await readCsv(dictionary);
    console.log(dict);

    var origTextContent = await fs.promises.readFile(origText);
    origTextContent = origTextContent.toString().trim();
    var origTextContents = origTextContent.replaceAll("\r", "").split("\n")

    var transTextContent = await fs.promises.readFile(translatedText);
    transTextContent = transTextContent.toString().trim();
    var transTextContents = transTextContent.replaceAll("\r", "").split("\n")

    if (origTextContents.length !== transTextContents.length) return console.error("Number of line between original text and translated texts are not same!", origTextContents.length, transTextContents.length);

    // write original text
    var resultOrig = clone(origTextContents);
    var resultTrans = clone(transTextContents);


    const assignBeforeSentence = async function(config) {
        if (!config.beforeSentence) return;
        for (var i in origTextContents) {
            for (var m in config.markers) {
                resultOrig.push(config.markers[m]+origTextContents[i]);
                resultTrans.push(config.markers[m]+transTextContents[i]);
            }
        }
    }

    const assignAfterSentence = async function(config) {
        if (!config.afterSentence) return;
        for (var i in origTextContents) {
            for (var m in config.markers) {
                resultOrig.push(origTextContents[i]+config.markers[m]);
                resultTrans.push(transTextContents[i]+config.markers[m]);
            }
        }
    }

    const assignTranslation = async function(config) {
        for (var i in origTextContents) {
            //lookup original text
            for (var x in dict) {
                if (!(origTextContents[i].includes(dict[x].original) && isMatchInsensitive(transTextContents[i], dict[x].translation.toLowerCase()))) continue;
                if (countOccurance(origTextContents[i], dict[x].original) != countOccuranceEn(transTextContents[i], dict[x].translation)) continue;


                for (var m in config.markers) {
                    var replacedOrig = origTextContents[i].replaceAll(dict[x].original, dict[x].original+config.markers[m]);
                    var replacedTrans = transTextContents[i].replaceAllInsensitive(dict[x].translation, dict[x].translation+config.markers[m]);
                    resultOrig.push(replacedOrig);
                    resultTrans.push(replacedTrans);
                }
            }
        }
    }

    const assignTokens = async function(config) {
        var combinations = getCombinations(config.markers);
        for (var c in combinations) {
            resultOrig.push(combinations[c].join(""));
            resultTrans.push(combinations[c].join(""));
        }
    }

    for (var i in config) {
        await assignBeforeSentence(config[i]);
        await assignAfterSentence(config[i]);
        await assignTranslation(config[i]);
        await assignTokens(config[i]);
    }

    await fs.promises.writeFile(resultOrigFile, resultOrig.join("\n"));
    await fs.promises.writeFile(resultTransFile, resultTrans.join("\n"));
    
    console.log("completed!");
    console.log("Modified original data is :", resultOrigFile);
    console.log("Modified Translated data is :", resultTransFile);
}();

