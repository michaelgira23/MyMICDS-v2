'use strict';

try {
	var config = require(__dirname + '/../libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var MongoClient = require('mongodb').MongoClient;
var portal = require(__dirname + '/../libs/portal.js');

try {
	MongoClient.connect(config.mongodb.uri, function (err, db) {
		if (err) throw new Error(err);

		var portalClasses = db.collection('portalClasses');
		var users = db.collection('users');
		var docsCount = 0;

		users.find({}, {user: true}).toArray(function (err, docs) {
			if (err) throw new Error(err);

			docs.forEach(function (userDoc) {
				portal.getClasses(db, userDoc.user, true, function (err, hasUrl, classes) {
					if (err) throw new Error(err);

					if (hasUrl) {
						portalClasses.insertMany(
							// map the array of classes into insert-able documents for Mongo
							classes.map(function (classStr) {
								return {
									userId: userDoc._id,
									classStr: classStr
								}
							}),
							function (err, result) {
								if (err) throw new Error(err);
								docsCount++;
								if (result.result.ok === 1) {
									process.stdout.write(`\r inserted ${docsCount} \r`);
								}
							}
						);
					}
				});
			});
		});
	});
} catch (e) {
	console.log(e);
}
