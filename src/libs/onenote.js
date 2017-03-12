// MyMICDS notes workflow: client request access token & sign in the user --> using the access token, share .one file with an array of users

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
 * @param {boolean} isSuccess - whether the sign in is success or not
 */

function signIn(clientId, redirectUri, scope, callback) {
	var child = opn(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=${scope}&response_type=token&redirect_uri=${redirectUri}`, { app: 'Chrome' });
	child.on('exit', function() {
		console.log('exit');
		callback(true);
	});
}

module.exports.signIn = signIn;
