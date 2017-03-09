'use strict';

/**
 * @file Manages Portal API endpoints
 */

var portal = require(__dirname + '/../libs/portal.js');

module.exports = function(app, db, socketIO) {
	app.post('/portal/test-url', function(req, res) {
		portal.verifyURL(req.body.url, function(err, isValid, url) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				valid: isValid,
				url  : url
			});
		});
	});

	app.post('/portal/set-url', function(req, res) {
		portal.setURL(db, req.user.user, req.body.url, function(err, isValid, validURL) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
				socketIO.user(req.user.user, 'portal', 'set-url', validURL);
			}
			res.json({
				error: errorMessage,
				valid: isValid,
				url  : validURL
			});
		});
	});

	app.post('/portal/get-classes', function(req, res) {
		portal.getClasses(db, req.user.user, function(err, hasURL, classes) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				hasURL: hasURL,
				classes: classes
			});
		});
	});

	app.post('/portal/day-rotation', function(req, res) {
		portal.getDayRotations(function(err, days) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				days: days
			});
		});
	});

	app.post('/portal/class-groups', function(req, res) {
		portal.findClassesByUser(db, req.user.user, function(err, classes) {
			res.json({
				error: err ? err.message : null,
				classes: classes
			});
		});
	});
};
