'use strict';

var notes = require(__dirname + '/../libs/notes.js');
var config = require(__dirname + '/../libs/config.js');
var querystring = require('querystring');

module.exports = function(app, db) {

	app.get('/microsoft/oauth', function(req, res) {
		//get tokens;
		var code = req.query.code;

		notes.getTokenFromCode(config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, code, function(err, token) {
			if (err) res.json({
				error: err.message
			})

			res.type('json').send(token);
		});
	});

	app.get('/microsoft/oauth/localhost', function(req, res) {
		// Redirect maintaining all the query params
		res.redirect('http://localhost:1420/microsoft/oauth?' + querystring.stringify(req.query));
	});
}
