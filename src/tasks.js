'use strict';

/**
 * @file Manages regularly scheduled tasks (similar to Cron-Jobs)
 */

try {
	var config = require(__dirname + '/libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var admins		  = require(__dirname + '/libs/admins.js');
var dailyBulletin = require(__dirname + '/libs/dailyBulletin.js');
var later         = require('later');
var MongoClient   = require('mongodb').MongoClient;
var weather       = require(__dirname + '/libs/weather.js');
var portal        = require(__dirname + '/libs/portal.js');
var notes       = require(__dirname + '/libs/notes.js');

// Only run these intervals in production so we don't waste our API calls
if(config.production) {

	console.log('Starting tasks server!');

	MongoClient.connect(config.mongodb.uri, function(err, db) {
		if(err) throw err;

		var fiveMinuteInterval = later.parse.text('every 5 min');

		/*
		 * Get Daily Bulletin every 5 minutes
		 */

		var updateBulletin = later.setInterval(function() {
			console.log('[' + new Date() + '] Check for latest Daily Bulletin');

			dailyBulletin.queryLatest(function(err) {
				if(err) {
					console.log('[' + new Date() + '] Error occured for Daily Bulletin! (' + err + ')');

					// Alert admins if there's an error querying the Daily Bulletin
					admins.sendEmail(db, {
						subject: 'Error Notification - Daily Bulletin Retrieval',
						html: 'There was an error when retrieving the daily bulletin.<br>Error message: ' + err
					}, function(err) {
						if(err) {
							console.log('[' + new Date() + '] Error occured when sending admin error notifications! (' + err + ')');
							return;
						}
						console.log('[' + new Date() + '] Alerted admins of error! (' + err + ')');
					});
				} else {
					console.log('[' + new Date() + '] Successfully got latest Daily Bulletin!');
				}
			});

		}, fiveMinuteInterval);

		/*
		 * Get new weather info every 5 minutes
		 */

		var updateWeather = later.setInterval(function() {
			console.log('[' + new Date() + '] Update Weather');

			weather.update(function(err, weatherJSON) {
				if(err) {
					console.log('[' + new Date() + '] Error occured for weather! (' + err + ')');

					// Alert admins if problem getting weather
					admins.sendEmail(db, {
						subject: 'Error Notification - Weather Retrieval',
						html: 'There was an error when retrieving the weather.<br>Error message: ' + err
					}, function(err) {
						if(err) {
							console.log('[' + new Date() + '] Error occured when sending admin error notifications! (' + err + ')');
							return;
						}
						console.log('[' + new Date() + '] Alerted admins of error! (' + err + ')');
					});
				} else {
					console.log('[' + new Date() + '] Successfully updated weather!');
				}
			});

		}, fiveMinuteInterval);

		var groupClasses = later.setInterval(function() {
			var portalClasses = db.collection('portalClasses');
			var users = db.collection('users');
			var docsCount = 0;

			users.find({}, {user: true}).toArray(function (err, docs) {
				if (err) throw new Error(err);

				docs.forEach(function (userDoc) {
					// set noCache to false so we dont reuse the cache
					portal.getClasses(db, userDoc.user, true, function (err, hasUrl, classes) {
						if (err) throw new Error(err);

						if (hasUrl) {
							portalClasses.insertMany(
								// map the array of classes into insert-able documents for Mongo
								classes.map(function (classStr) {
									return {
										userId: userDoc._id,
										classStr: classStr
									}
								}),
								function (err, result) {
									if (err) throw new Error(err);
									docsCount++;
									if (result.result.ok === 1) {
										process.stdout.write(`\r inserted ${docsCount} \r`);
									}
								}
							);
						}
					});
				});
			});
		}, later.parse.recur().every(12).hour());

		var addNotebooks = later.setInterval(function() {
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
		}, later.parse.recur().every(1).day());
	});
} else {
	console.log('Not starting tasks server because we are not on production.');
}
