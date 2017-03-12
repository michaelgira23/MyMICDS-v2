// MyMICDS notes workflow: client request access token & sign in the user --> using the access token, share .one file with an array of users

var OAuth = require('OAuth');
var request = require('request');

/**
 * Function to sign in the MyMCIDS Microsoft accouint
 * @function sign-in
 * @param {string} clientId - Microsoft clien id for mymicds application.
 * @param {string} redirectUri - The redirect URL that the browser is sent to when authentication is complete. In this case we just need to keep it the same as we configured. 
 * @param {string} scope - The type of access our app is granted whe the user signs in. Avaliable types are: offline_access, files.read, files.read.all, files.readwrite, files.readwrite.all. Will be a space separaeted list. 
 */

function signIn(clientId, redirectUri, scope) {
	
}
