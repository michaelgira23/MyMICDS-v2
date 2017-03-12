'use strict';

var onenote = require(__dirname + '/../libs/onenote.js');
var config = require(__dirname + '/../libs/config.js');

module.exports = function(app, db) {
	app.get('/microsoft/oauth', function(req, res) {
		//get tokens;
		var code = req.query.code;

		onenote.getTokenFromCode(config.microsoft.clientId, config.microsoft.redirectUri, config.microsoft.clientSecret, code, function(err, token) {
			res.type('json').send(token);
		});
	});
}
