'use strict';

try {
	var config = require(__dirname + '/../libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var MongoClient = require('mongodb').MongoClient;
var portal = require(__dirname + '/../libs/portal.js');

var user = process.argv[2];

MongoClient.connect(config.mongodb.uri, function(err, db) {
	if(err) throw err;

	portal.getClasses(db, user, false, function(err, hasURL, classes) {
		if(!classes) throw 'Classes is null!';

		console.log(classes);
		console.log('');

		classes.forEach(className => {
			console.log(portal.cleanUp(className));
		});

		process.exit();
	});
});
