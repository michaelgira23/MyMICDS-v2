'use strict'

try {
	var config = require(__dirname + '/../libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var MongoClient = require('mongodb').MongoClient;

var portal = require(__dirname + '/../libs/portal.js');
var notes = require(__dirname + '/../libs/notes.js');
var dates = require(__dirname + '/../libs/dates.js');

try {
	MongoClient.connect(config.mongodb.uri, function (err, db) {
		if (err) throw new Error(err);

		var schoolYearStr = ' [' + dates.getSchoolYear()[0] + ' - ' + dates.getSchoolYear()[1] + ']';

		notes.getToken(config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, function(err, token) {
			if (err) throw new Error(err);

			portal.findAllClasses(db, function(err, classes) {
				if (err) throw new Error(err);

				classes.splice(0, 1).forEach(function(classStr) {

					notes.createNotebook(db, token, classStr + schoolYearStr, function(err, notebook) {
						if (err) throw new Error(err);
						console.log(notebook);
					});

				});

			});
		
		});
	});
} catch(e) {
	console.log('Something went wrong! ' + e);
}
