'use strict';

var notes = require(__dirname + '/../libs/notes.js');
var config = require(__dirname + '/../libs/config.js');
var path = require('path');
var querystring = require('querystring');

module.exports = function(app, db) {

	app.get('/microsoft/oauth', function(req, res) {
		//get tokens;
		var code = req.query.code;

		notes.getTokenFromCode(config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, code, function(err, token) {
			if (err) res.json({
				error: err.message
			})

			res.json(token);
		});
	});

	app.get('/microsoft/oauth/localhost', function(req, res) {
		// Send a file that redirects so therefore we can redirect to the _client's_ localhost, not ours.
		res.sendFile(path.resolve(__dirname + '/../html/oauth-redirect.html'));
	});
}
