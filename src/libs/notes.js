'use strict';

// MyMICDS notes workflow: client request access token & sign in the user --> using the access token, share .one file with an array of users
// create a route that catches the token, so that when sign in is successful, we procceed with sharing notes books and stuff

var OAuth = require('oauth');
var request = require('request');
var opn = require('opn');
var moment = require('moment');
var fs = require('fs');
var asyncLib = require('async');

var users = require(__dirname + '/users.js');
var portal = require(__dirname + '/../libs/portal.js');
var dates = require(__dirname + '/../libs/dates.js');

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
	// Once microsoft updates its onenote api to include notes on personal onedrives, we can use the other link
	// opn(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`, { app: 'Chrome' });
	opn(`https://login.live.com/oauth20_authorize.srf?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`, { app: 'Chrome' });
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

/**
 * Callback containing the token information
 * @callback getTokenFromCodeCallback
 * 
 * @param {object} err - error object, null if success
 * @param {object} tokens - reponse containing tokens
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

		body = JSON.parse(body);

		var type;
		if (body.scope.split(' ')[0] === 'wl.offline_access') {
			type = 'OneNote';
		} else {
			type = 'OneDrive';
		}

		var json = JSON.stringify({
			accessToken: body['access_token'],
			refreshToken: body['refresh_token'],
			lastEdit: moment().unix(),
			expiresIn: body['expires_in']
		});

		fs.writeFile(__dirname + '/' + type + 'Tokens.json', json, function(err) {
			if (err) return callback(err, null);

			callback(null, body);
		});
	});
}

/**
 * @function getToken
 * 
 * @param {*} clientId 
 * @param {*} redirectUri 
 * @param {*} clientSecret 
 * @param {*} refreshToken 
 * @param {*} callback
 */
function getToken(type, clientId, redirectUri, clientSecret, callback) {
	fs.readFile(__dirname + '/' + type + 'Tokens.json', 'utf8', function(err, data) {
		if (err) return callback(err, null);

		var tokens = JSON.parse(data);

		// if the tokens are still valid use the token, otherwise request a new one
		if (moment().unix() - tokens.lastEdit < tokens.expiresIn - 600) {
			callback(null, tokens.accessToken);
		} else {
			var options = {
				url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
				method: 'POST',
				form: {
					'client_id': clientId,
					'redirect_uri': redirectUri,
					'client_secret': clientSecret,
					'refresh_token': tokens.refreshToken,
					'grant_type': 'refresh_token'
				}
			};

			request(options, function(err, res, body) {
				if (err) return callback(err, null);

				if (res.statusCode !== 200) return callback(new Error(res.statusCode + ': ' + res.statusMessage + '\r\n' + body['error_description']), null);

				body = JSON.parse(body);

				var json = JSON.stringify({
					accessToken: body['access_token'],
					refreshToken: body['refresh_token'],
					lastEdit: moment().unix(),
					expiresIn: body['expires_in']
				});
	
				fs.writeFile(__dirname + '/' + type + 'Tokens.json', json, function(err) {
					if (err) return callback(err, null);

					callback(null, body['access_token'])
				});
			});
		}
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
 * @param {boolean} conflict - if there is already a notebook at location
 * @param {object} notebook - response object returned from OneNote api
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
			'name': name
		},
		json: true
	};
	request(options, function(err, res, body) {
		if (err) return callback(err, null, null);

		if (res.statusCode === 409) return callback(null, true, null);

		if (res.statusCode !== 201) return callback(new Error('Something wrong with the request: ' + res.statusCode + ' ' + res.statusMessage + '\r\n' + (body ? body.error.message : '')), null, null);

		// prevent "key contains '.'" error
		delete body['@odata.context'];

		var notebooks = db.collection('notebooks');

		notebooks.insertOne(body, function(err) {
				if (err) return callback(new Error(err), null, null);

				callback(null, false, body);
			});
	});
}

/**
 * @function shareNotebook
 * @param {*} db 
 * @param {*} authToken 
 * @param {*} notebookPath
 * @param {*} userIds 
 * @param {*} callback 
 */
function shareNotebook(db, authToken, notebookPath, userIds, callback) {
	asyncLib.map(
		userIds,
		function(userId, usersCb) {
			users.getById(db, userId, function(err, user) {
				if (err) return usersCb(new Error(err), null);

				usersCb(null, user);
			});
		}, 
		function(err, users) {
			if (err) {
				callback(new Error(err), null);
				return;
			}

			var options = {
				url: `https://graph.microsoft.com/v1.0/drive/root:/${escape(notebookPath)}:/invite`,
				method: 'POST',
				json: true,
				headers: {
					'Authorization': 'Bearer ' + authToken
				},
				body: {
					'requireSignIn': false,
					'sendInvitation': false,
					'roles': ['write'],
					'recipients': users.map(function(user) {
						return {
							'email': user.user + '@micds.org'
						};
					}),
					'message': ''
				}
			};
			request(options, function(err, res, body) {
				if (err) return callback(err, null);

				if (res.statusCode !== 200) return callback(new Error(res.statusCode + ': ' + res.statusMessage + '\r\nCode: ' + body.error.code + '\r\nMessage: ' + body.error.message), null);

				callback(null, body);
			});
		}
	);
}

/**
 * 
 * @param {*} db 
 * @param {*} classStr 
 * @param {*} callback 
 */
function getOneNoteLink(db, classStr, callback) {
	var notebooks = db.collection('notebooks');

	notebooks.find({ name: addYears(classStr)}).toArray(function(err, nb) {
		if (err) return callback(err, null);

		if (nb.length > 1) {
			callback(new Error('There seems to be multiple notebooks under the same class name.'), null);
		} else {
			callback(null, nb[0].links);
		}
	});
}

function addYears(classStr) {
	var schoolYearStr = ' [' + dates.getSchoolYear()[0] + ' - ' + dates.getSchoolYear()[1] + ']';
	return (classStr + schoolYearStr).replace(/[?*\/:<>|']/g, ' ');
}

module.exports.signIn = signIn;
module.exports.createNotebook = createNotebook;
module.exports.shareNotebook = shareNotebook;
module.exports.getTokenFromCode = getTokenFromCode;
module.exports.getToken = getToken;
module.exports.getOneNoteLink = getOneNoteLink;
module.exports.addYears = addYears;
