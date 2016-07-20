'use strict';

/**
 * @file Manages Background API endpoints
 */

var backgrounds = require(__dirname + '/../libs/backgrounds.js');

module.exports = function(app, db) {

	app.post('/background/get', function(req, res) {
		backgrounds.getBackground(req.session.user, req.body.variation, function(err, backgroundURL) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({
				error: errorMessage,
				url  : backgroundURL
			});
		});
	});

	app.post('/background/change', function(req, res) {
		// Write image to user-backgrounds
		backgrounds.uploadBackground(db)(req, res, function(err) {
			if(err) {
				res.json({ error: err.message });
				return;
			}

			// Add blurred version of image
			backgrounds.blurUser(req.session.user, function(err) {
				if(err) {
					var errorMessage = err.message;
				} else {
					var errorMessage = null;
				}
				res.json({ error: errorMessage });
			});
		});
	});

	app.post('/background/delete', function(req, res) {
		backgrounds.deleteBackground(req.session.user, function(err) {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}
			res.json({ error: errorMessage });
		});
	});

}