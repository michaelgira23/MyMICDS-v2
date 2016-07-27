'use strict';

/**
 * @file Manages Daily Bulletin API endpoints
 */

var dailyBulletin = require(__dirname + '/../libs/dailyBulletin.js');

module.exports = function(app, db) {

	app.post('/daily-bulletin/list', function(req, res) {
		dailyBulletin.getList(function(err, bulletins) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				baseURL: dailyBulletin.baseURL,
				bulletins: bulletins
			});
		});
	});

	/**
	 * @TODO: Testing only! Please remove for actual version!
	 */

	app.post('/daily-bulletin/query', function(req, res) {
		dailyBulletin.queryLatest(function(err) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({ error: errorMessage });
		});
	});

	/**
	 * @TODO: Testing only! Please remove for actual version!
	 */

	app.post('/daily-bulletin/query-all', function(req, res) {
		dailyBulletin.queryAll(function(err) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({ error: errorMessage });
		});
	});

}
