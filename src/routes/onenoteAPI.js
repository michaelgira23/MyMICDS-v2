'use strict';

var onenote = require(__dirname + '/../libs/onenote');

module.exports = function(app, db) {
	app.get('/onenote/auth-redirect', function(req, res) {
		//get tokens;
		var auth = {
			accessToken: req.query['access_token'],
			authenticationToken: req.query['authentication_token'],
			scope: req.query['scope'],
			userId: req.query['user_id']
		}
	});
}
