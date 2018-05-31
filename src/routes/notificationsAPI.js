const notifications = require(__dirname + '/../libs/notifications.js');

module.exports = (app, db) => {

	app.post('/notifications/unsubscribe', (req, res) => {
		let user = req.user.user;
		let hash = true;

		if (!user) {
			user = req.body.user;
			hash = req.body.hash;
		}

		notifications.unsubscribe(db, user, hash, req.body.scopes, err => {
			let error = null;
			if(err) {
				error = err.message;
			}
			res.json({ error });
		});
	});

};
