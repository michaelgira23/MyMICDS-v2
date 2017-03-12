'use strict';

// MyMICDS notes workflow: client request access token & sign in the user --> using the access token, share .one file with an array of users
// create a route that catches the token, so that when sign in is successful, we procceed with sharing notes books and stuff

var OAuth = require('oauth');
var request = require('request');
var opn = require('opn');

/**
 * Function to sign in the MyMCIDS Microsoft accouint
 * @function sign-in
 * @param {string} clientId - Microsoft client id for mymicds application.
 * @param {string} redirectUri - The redirect URL that the browser is sent to when authentication is complete. In this case we just need to keep it the same as we configured. 
 * @param {string} scope - The type of access our app is granted whe the user signs in. Avaliable types are: offline_access, files.read, files.read.all, files.readwrite, files.readwrite.all. Will be a space separaeted list. 
 * @param {signInCallback} callback - Callback
 */

/**
 * callback for the sign in method
 * @callback signInCallback
 * @param {object} err - error, null if successful
 */

function signIn(clientId, redirectUri, scope, callback) {
	opn(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`, { app: 'Chrome' }, function(err) {
		if (err) {
			return callback(err);
		}
		callback(null);
	});
}

/**
 * get access tokens and refresh tokens from authorization code
 * @function getTokenFromCode
 * 
 * @param {string} clientId 
 * @param {string} redirectUri 
 * @param {string} clientSecret 
 * @param {string} code 
 * @param {getTokenFromCodeCallback} callback 
 */

function getTokenFromCode(clientId, redirectUri, clientSecret, code, callback) {
	var options = {
		url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
		method: 'POST',
		form: {
			'client_id': clientId,
			'redirect_uri': redirectUri,
			'client_secret': clientSecret,
			'code': code,
			'grant_type': 'authorization_code'
		}
	};

	request(options, function(err, res, body) {
		if (err) return callback(err, null);

		callback(null, body)
	});
}

/**
 * create a onenote notebook under specified name, then store the link to notebook in db
 * @function createNotebook
 * 
 * @param {object} db - database instance
 * @param {string} authToken - authorization token from the sign in redirect link
 * @param {string} name - name of the notebook
 * @param {createNotebookCallback} callback - callback
 */

/**
 * callback for createNotebook function
 * @callback createNotebookCallback
 * 
 * @param {object} err - error object, null if success
 */
function createNotebook(db, authToken, name, callback) {
	var notelinks = db.collection('noteLinks');

	var options = {
		url: 'https://www.onenote.com/api/v1.0/me/notes/notebooks',
		method: 'POST',
		headers: {
			'Authorization': 'Bearer ' + authToken
		},
		body: {
			'name': 'testNutbook'
		},
		json: true
	};
	request(options, function(err, res, body) {
		if (err) return callback(err);
		callback(null);

		console.log(body);
	});
}

function shareNotebook(name, users) {

}

function getOnenoteLink(classStr) {

}

module.exports.signIn = signIn;
module.exports.createNotebook = createNotebook;
module.exports.getTokenFromCode = getTokenFromCode;
