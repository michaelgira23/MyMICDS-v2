'use strict'

var config = require(__dirname + '/../libs/config.js');
var onenote = require(__dirname + '/../libs/onenote.js');

onenote.signIn(config.microsoft.clientId, config.microsoft.redirectUri, escape('offline_access files.readwrite.all'), function(err) {
	if (err) {
		console.log(err);
	}
	console.log('redirect to login page')
});
