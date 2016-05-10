/**
 * @file Compiles Sass
 * @module sass
 */

var fs   = require('fs');
var sass = require('node-sass');

/**
 * Watches directory for changes and compiles Sass.
 * @function watchSass
 * 
 * @param {string} sassDir Directory in which the Sass files are kept.
 * @param {string} cssDir Directory where the compiled CSS will be written.
 */

function watchSass(sassDir, cssDir) {
    fs.watch(sassDir, function(event, filename) {
        var sassFile = sassDir + '/' + filename;
        sass.render({
            file: sassFile,
        }, function(sassErr, result) {
            if(!sassErr) {
                // Gets raw filename sans .scss extension
                var cssFilename = filename.replace('.scss', '');
                // Appends .css file extension
                cssFilename += '.css';
                
                var cssFile = cssDir + '/' + cssFilename;
                fs.writeFile(cssFile, result.css, function(writeErr) {
                    if(!writeErr) {
                        console.log('File ' + sassFile + ' was compiled to ' + cssFile);
                    } else {
                        console.log('There was a problem writing the file! Check to make sure node has proper write permissions.');
                    }
                });
            } else {
                console.log('Sass error: ' + sassErr.message + ' in file ' + sassErr.file + ' at line ' + sassErr.line);
            }
        });
    });
}

module.exports.watchSass = watchSass;