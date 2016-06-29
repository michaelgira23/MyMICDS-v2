/**
 * @file Manages schedule API endpoints
 */

var config = require(__dirname + '/../libs/config.js');

var portal     = require(__dirname + '/../libs/portal.js');
var MongoClient = require('mongodb').MongoClient;

module.exports = function(app) {
    app.post('/portal/test-url', function(req, res) {
        portal.verifyURL(req.body.url, function(err, isValid, url) {
            if(err) {
                var errorMessage = err.message;
            } else {
                var errorMessage = null;
            }
            res.json({
                error: errorMessage,
                valid: isValid,
                url  : url
            });
        });
    });

    app.post('/portal/set-url', function(req, res) {
        MongoClient.connect(config.mongodbURI, function(err) {
            if(err) {
                db.close();
                res.json({
                    error: 'There was a problem connecting to the database!',
                    valid: null,
                    url  : null
                });
                return;
            }

            portal.setURL(req.session.user, req.body.url, function(err, isValid, validURL) {
                if(err) {
                    var errorMessage = err.message;
                } else {
                    var errorMessage = null;
                }
                res.json({
                    error: errorMessage,
                    valid: isValid,
                    url  : validURL
                });
            });
        });
    });

    app.post('/portal/get-schedule', function(req, res) {
        var date = {
            year : parseInt(req.body.year),
            month: parseInt(req.body.month),
            day  : parseInt(req.body.day)
        };

        MongoClient.connect(config.mongodbURI, function(err) {
            if(err) {
                db.close();
                res.json({
                    error: 'There was a problem connecting to the database!',
                    schedule: null
                });
                return;
            }
            portal.getSchedule(db, req.session.user, date, function(err, hasURL, schedule) {
                if(!err && hasURL) {
                    res.json({
                        error: null,
                        schedule: schedule
                    });
                    return;
                }

                // There was an error, default to generic schedule
                portal.getDayRotation(date, function(err, scheduleDay) {
                    if(err) {
                        res.json({
                            error: 'There was a problem fetching your schedule!',
                            schedule: null
                        });
                        return;
                    }

                    var end = new Date(date.year, date.month, date.day, 15, 15);
                    // If day is Wednesday, make start date 9 instead of 8
                    var start = new Date(date.year, date.month, date.day, end.getDay() === 3 ? 9:8);

                    var schedule = {
                        day: scheduleDay,
                        classes: [{
                            name : 'School',
                            start: start,
                            end  : end
                        }],
                        allDay: []
                    }

                    res.json({
                        error: null,
                        schedule: schedule
                    });

                });
            });
        });
    });

}
