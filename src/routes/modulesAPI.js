'use strict';

/**
 * @file Manages modules API endpoints
 */

var modules = require(__dirname + '/../libs/modules.js');

module.exports = function(app, db) {

	app.post('/modules/get', function(req, res) {
		modules.get(db, req.user.user, function(err, modules) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				modules: modules
			});
		});
	});

	app.post('/modules/upsert', function(req, res) {
		modules.upsert(db, req.user.user, req.body.modules, function(err) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage
			});
		});
	});

};
