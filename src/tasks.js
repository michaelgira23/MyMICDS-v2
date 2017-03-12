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
var portal       = require(__dirname + '/libs/portal.js');

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
	});
} else {
	console.log('Not starting tasks server because we are not on production.');
}
