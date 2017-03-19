'use strict'

var config = require(__dirname + '/../libs/config.js');
var notes = require(__dirname + '/../libs/notes.js');

// notes.signIn(config.microsoft.clientId, config.microsoft.redirectUri, escape(config.microsoft.oneDriveScopes), function(err) {
// 	if (err) {
// 		console.log(err);
// 	}
// 	console.log('redirect to login page')
// });

notes.signIn(config.microsoft.clientId, config.microsoft.redirectUri, escape(config.microsoft.scopes.onedrive), function(err) {
	if (err) {
		console.log(err);
	}
	console.log('redirect to login page')
});

notes.signIn(config.microsoft.clientId, config.microsoft.redirectUri, escape(config.microsoft.scopes.onenote), function(err) {
	if (err) {
		console.log(err);
	}
	console.log('redirect to login page')
});
