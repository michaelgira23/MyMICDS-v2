'use strict'

try {
	var config = require(__dirname + '/../libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var MongoClient = require('mongodb').MongoClient;

var portal = require(__dirname + '/../libs/portal.js');
var notes = require(__dirname + '/../libs/notes.js');

try {
	MongoClient.connect(config.mongodb.uri, function (err, db) {
		if (err) throw new Error(err);

		notes.getToken('OneNote', config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, function(err, ONToken) {
			if (err) throw new Error(err);

			notes.getToken('OneDrive', config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, function(err, ODToken) {
				if (err) throw new Error(err);

				portal.findAllClasses(db, function(err, classes) {
					if (err) throw new Error(err);

					var createCount = 0;
					var skipCount = 0;
					var shareCount = 0
					classes.forEach(function(classStr, index) {

						var interval = index * 200;
						setTimeout(function() {
							var notebookName = notes.addYears(classStr);
							notes.createNotebook(db, ONToken, notebookName, function(err, conflict, notebook) {
								if (err) throw new Error(err);

								if (!conflict) {
									process.stdout.write(`\rnotebook created: ${++createCount} | notebook skipped: ${skipCount} | notebook shared: ${shareCount}`);
								} else {
									process.stdout.write(`\rnotebook created: ${createCount} | notebook skipped: ${++skipCount} | notebook shared: ${shareCount}`);
								}

								portal.findUsersByClass(db, classStr, function(err, userIds) {
									if (err) throw new Error(err);

									var notebookPath = 'Documents/' + notebookName;
									notes.shareNotebook(db, ODToken, notebookPath, userIds, function(err, res) {
										if (err) throw new Error(err);

										process.stdout.write(`\rnotebook created: ${createCount} | notebook skipped: ${skipCount} | notebook shared: ${++shareCount}`);
									});
								});
							});
						}, interval)

					});

				});

			});
		
		});
	});
} catch(e) {
	console.log('Something went wrong! ' + e);
}
