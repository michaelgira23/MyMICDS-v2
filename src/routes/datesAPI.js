/**
 * @file Manages user API endpoints
 */
const dates = require(__dirname + '/../libs/dates.js');

module.exports = app => {

	app.post('/dates/school-starts', (req, res) => {
		res.json({ error: null, date: dates.schoolStarts() });
	});

	app.post('/dates/school-ends', (req, res) => {
		res.json({ error: null, date: dates.schoolEnds() });
	});

	app.post('/dates/breaks', (req, res) => {
		dates.getBreaks((err, breaks) => {
			let error = null;
			if(err) {
				error = err.message;
			}
			res.json({ error, breaks });
		});
	});

};
