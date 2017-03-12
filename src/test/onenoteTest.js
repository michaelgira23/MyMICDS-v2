var config = require(__dirname + '/../libs/config.js');
var onenote = require(__dirname + '/../libs/onenote.js');

onenote.signIn(config.onedrive.clientId, config.onedrive.redirectUri, 'offline_access files.read', function(isSuccess) {
	console.log('succ')
});
