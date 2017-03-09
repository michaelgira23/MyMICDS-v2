'use strict';

/**
 * @file Reads calendar feed to determine schedule / day and other important events
 * @module portal
 */

var config = require(__dirname + '/config.js');

var _             = require('underscore');
var aliases       = require(__dirname + '/aliases.js');
var asyncLib      = require('async');
var classes       = require(__dirname + '/classes.js');
var ical          = require('ical');
var moment        = require('moment');
var prisma        = require('prisma');
var querystring   = require('querystring');
var request       = require('request');
var blockSchedule = require(__dirname + '/blockSchedule.js');
var url           = require('url');
var users         = require(__dirname + '/users.js');

// URL Calendars come from
var urlPrefix = 'https://micds.myschoolapp.com/podium/feed/iCal.aspx?z=';
// RegEx to test if calendar summary is a valid Day Rotation
var validDayRotation = /^Day [1-6] \((US|MS)\)$/;
var validDayRotationPlain = /^Day [1-6]$/;

var portalSummaryBlock = / - [0-9]{1,2} \([A-G][0-9]\)$/g;
// Modified portal summary block to clean up everythiing for displaying
var cleanUpBlockSuffix = / -( )?([0-9]{1,2} \(.+\))?$/g;

// Range of Portal calendars in months
var portalRange = {
	previous: 2,
	upcoming: 12
};

/**
 * Makes sure a given url is valid and it points to a Portal calendar feed
 * @function verifyURL
 *
 * @param {string} portalURL - URI to iCal feed
 * @param {verifyURLCallback} callback - Callback
 */

/**
 * Returns whether url is valid or not
 * @callback verifyURLCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Boolean|string} isValid - True if valid URL, string describing problem if not valid. Null if error.
 * @param {string} url - Valid and formatted URL to our likings. Null if error or invalid url.
 */

function verifyURL(portalURL, callback) {

	if(typeof callback !== 'function') return;

	if(typeof portalURL !== 'string') {
		callback(new Error('Invalid URL!'), null, null);
		return;
	}

	// Parse URL first
	var parsedURL = url.parse(portalURL);
	var queries = querystring.parse(parsedURL.query);

	if(typeof queries.z !== 'string') {
		callback(null, 'URL does not contain calendar ID!', null);
		return;
	}

	var validURL = urlPrefix + queries.z;

	// Not lets see if we can actually get any data from here
	request(validURL, function(err, response, body) {
		if(err) {
			callback(new Error('There was a problem fetching portal data from the URL!'), null, null);
			return;
		}
		if(response.statusCode !== 200) {
			callback(null, 'Invalid URL!', null);
			return;
		}

		var data = ical.parseICS(body);

		// School Portal does not give a 404 if calendar is invalid. Instead, it gives an empty calendar.
		// Unlike Canvas, the portal is guaranteed to contain some sort of data within a span of a year.
		if(_.isEmpty(data)) {
			callback(null, 'Invalid URL!', null);
			return;
		}

		// Look through every 'Day # (US/MS)' andd see how many events there are
		var dayDates = {};
		for(var eventUid in data) {
			var calEvent = data[eventUid];
			// If event doesn't have a summary, skip
			if(typeof calEvent.summary !== 'string') continue;

			// See if valid day
			if(validDayRotation.test(calEvent.summary)) {
				// Get actual day
				var day = calEvent.summary.match(/[1-6]/)[0];
				// Get date
				var start = new Date(calEvent.start);

				// Add to dayDates object
				if(typeof dayDates[day] === 'undefined') {
					dayDates[day] = [];
				}
				dayDates[day].push({
					year : start.getFullYear(),
					month: start.getMonth() + 1,
					day  : start.getDate()
				});
			}
		}

		if(_.isEmpty(dayDates)) {
			callback(null, 'The calendar does not contain the information we need! Make sure you\'re copying your personal calendar!', null);
			return;
		}

		callback(null, true, validURL);

	});
}

/**
 * Sets a user's calendar URL if valid
 * @function setUrl
 *
 * @param {Object} db - Database connection
 * @param {string} user - Username
 * @param {string} url - Calendar url
 * @param {setUrlCallback} callback - Callback
 */

 /**
  * Returns the valid url that was inserted into database
  * @callback setUrlCallback
  *
  * @param {Object} err - Null if success, error object if failure
  * @param {Boolean|string} isValid - True if valid URL, string describing problem if not valid. Null if error.
  * @param {string} validURL - Valid url that was inserted into database. Null if error or url invalid.
  */

function setURL(db, user, url, callback) {
	if(typeof callback !== 'function') {
		callback = function() {};
	}

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'), null, null);
		return;
	}

	users.get(db, user, function(err, isUser, userDoc) {
		if(err) {
			callback(err, null, null);
			return;
		}
		if(!isUser) {
			callback(new Error('User doesn\'t exist!'), null, null);
			return;
		}

		verifyURL(url, function(err, isValid, validURL) {
			if(err) {
				callback(err, null, null);
				return;
			} else if(isValid !== true) {
				callback(null, isValid, null);
				return;
			}

			var userdata = db.collection('users');

			userdata.update({ _id: userDoc['_id'] }, { $set: { portalURL: validURL }}, { upsert: true }, function(err, result) {
				if(err) {
					callback(new Error('There was a problem updating the URL to the database!'), null, null);
					return;
				}

				callback(null, true, validURL);

			});
		});
	});
}

/**
 * Retrieves the calendar feed of a specific user
 * @function getCal
 *
 * @param {db} db - Database connection
 * @param {string} user - Username
 * @param {getCalCallback} callback - Callback
 */

/**
 * Returns the parsed iCal feed of the user
 * @callback getCalCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Boolean} hasURL - Whether or not the user has a Portal URL set. Null if error.
 * @param {Object} cal - Parsed iCal feed. Null if error.
 */

function getCal(db, user, callback) {
	if(typeof callback !== 'function') return;

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'), null, null);
		return;
	}
	if(typeof user !== 'string') {
		callback(new Error('Invalid username!'), null, null);
		return;
	}

	users.get(db, user, function(err, isUser, userDoc) {
		if(err) {
			callback(err, null, null);
			return;
		}
		if(!isUser) {
			callback(new Error('User doesn\'t exist!'), null, null);
			return;
		}
		if(typeof userDoc['portalURL'] !== 'string') {
			callback(null, false, null);
			return;
		}

		request(userDoc['portalURL'], function(err, response, body) {
			if(err) {
				callback(new Error('There was a problem fetching the day rotation!'), null);
				return;
			}
			if(response.statusCode !== 200) {
				callback(new Error('Invalid URL!'), null, null);
				return;
			}

			var data = ical.parseICS(body);

			// School Portal does not give a 404 if calendar is invalid. Instead, it gives an empty calendar.
			// Unlike Canvas, the Portal is guaranteed to contain some sort of data within a span of a year.
			if(_.isEmpty(data)) {
				callback(new Error('Invalid URL!'), null, null);
				return;
			}

			callback(null, true, data);
		});
	});
}

/**
 * Get schedule day rotation
 * @function getDayRotation
 *
 * @param {Object} date - Date object containing date to retrieve schedule. Leaving fields empty will default to today.
 * @param {getDayRotationCallback} callback - Callback
 */

 /**
  * Returns an integer between 1 and 6 for what day it is
  * @callback getDayRotationCallback
  *
  * @param {Object} err - Null if success, error object if failure.
  * @param {scheduleDay} day - Integer between 1 and 6. Null if error or no available day.
  */

function getDayRotation(date, callback) {
	if(typeof callback !== 'function') return;

	var scheduleDate = new Date(date);
	var scheduleNextDay = new Date(scheduleDate.getTime() + 60 * 60 * 24 * 1000);

	request(urlPrefix + config.portal.dayRotation, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			callback(new Error('There was a problem fetching the day rotation!'), null);
			return;
		}

		var data = ical.parseICS(body);

		// School Portal does not give a 404 if calendar is invalid. Instead, it gives an empty calendar.
		// Unlike Canvas, the portal is guaranteed to contain some sort of data within a span of a year.
		if(_.isEmpty(data)) {
			callback(new Error('There was a problem fetching the day rotation!'), null);
			return;
		}

		for(var eventUid in data) {
			var calEvent = data[eventUid];
			if(typeof calEvent.summary !== 'string') continue;

			var start = new Date(calEvent['start']);
			var end   = new Date(calEvent['end']);

			var startTime = start.getTime();
			var endTime   = end.getTime();

			// Check if it's an all-day event
			if(startTime <= scheduleDate.getTime() && scheduleNextDay.getTime() <= endTime) {
				// See if valid day
				if(validDayRotationPlain.test(calEvent.summary)) {
					// Get actual day
					var day = parseInt(calEvent.summary.match(/[1-6]/)[0]);
					callback(null, day);
					return;
				}
			}
		}

		callback(null, null);

	});
}


/**
 * Get all of the schedule day rotations we can get
 * @function getDayRotations
 *
 * @param {getDayRotationCallback} callback - Callback
 */

 /**
  * Returns an integer between 1 and 6 for what day it is
  * @callback getDayRotationsCallback
  *
  * @param {Object} err - Null if success, error object if failure.
  * @param {scheduleDay} days - Object containing integers 1-6 organized by year, month, and date (Ex. January 3rd, 2017 would be `day.2017.1.3`)
  */

function getDayRotations(callback) {
	if(typeof callback !== 'function') return;

	var days = {};

	request(urlPrefix + config.portal.dayRotation, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			callback(new Error('There was a problem fetching the day rotation!'), null);
			return;
		}

		var data = ical.parseICS(body);

		// School Portal does not give a 404 if calendar is invalid. Instead, it gives an empty calendar.
		// Unlike Canvas, the portal is guaranteed to contain some sort of data within a span of a year.
		if(_.isEmpty(data)) {
			callback(new Error('There was a problem fetching the day rotation!'), null);
			return;
		}

		for(var eventUid in data) {
			var calEvent = data[eventUid];
			if(typeof calEvent.summary !== 'string') continue;

			var start = new Date(calEvent['start']);
			var end   = new Date(calEvent['end']);

			var year = start.getFullYear();
			var month = start.getMonth() + 1;
			var date = start.getDate();

			// See if valid day
			if(validDayRotationPlain.test(calEvent.summary)) {
				// Get actual day
				var day = parseInt(calEvent.summary.match(/[1-6]/)[0]);

				if (typeof days[year] !== 'object') {
					days[year] = {};
				}

				if (typeof days[year][month] !== 'object') {
					days[year][month] = {};
				}

				days[year][month][date] = day;
			}
		}

		callback(null, days);

	});
}

/**
 * Gets a user's classes from the PORTAL, not CANVAS.
 * @function getClasses
 *
 * @param {Object} db - Database object
 * @param {string} user - User to get classes from
 * @param {getPortalClassesCallback} callback - Callback
 */

/**
 * Returns array of classes from portal
 * @callback getPortalClassesCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Boolean} hasURL - Whether or not the user has a Portal URL set. Null if error.
 * @param {Array} classes - Array of classes from portal. Null if error.
 */

function getClasses(db, user, callback) {
	if(typeof callback !== 'function') return;

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'), null, null);
		return;
	}
	if(typeof user !== 'string') {
		callback(new Error('Invalid username!'), null, null);
		return;
	}

	users.get(db, user, function(err, isUser, userDoc) {
		if(err) {
			callback(err, null, null);
			return;
		}
		if(!isUser) {
			callback(new Error('User doesn\'t exist!'), null, null);
			return;
		}

		if(typeof userDoc['portalURL'] !== 'string') {
			callback(null, false, null);
			return;
		}

		request(userDoc['portalURL'], function(err, response, body) {
			if(err) {
				callback(new Error('There was a problem fetching portal data from the URL!'), null, null);
				return;
			}
			if(response.statusCode !== 200) {
				callback(new Error('Invalid URL!'), null, null);
				return;
			}

			var data = ical.parseICS(body);

			// School Portal does not give a 404 if calendar is invalid. Instead, it gives an empty calendar.
			// Unlike Canvas, the portal is guaranteed to contain some sort of data within a span of a year.
			if(_.isEmpty(data)) {
				callback(new Error('Invalid URL!'), null, null);
				return;
			}

			parseIcalClasses(data, callback);

		});
	});
}

/**
 * Retrieves all the classes in a parsed iCal object
 * @function parseIcalClasses
 *
 * @param {Object} data - Parsed iCal object
 * @param {parseIcalClassesCallback} callback - Callback
 */

 /**
  * Returns array of classes from portal
  * @callback parseIcalClassesCallback
  *
  * @param {Object} err - Null if success, error object if failure.
  * @param {Boolean} hasURL - Whether or not the user has a Portal URL set. Null if error.
  * @param {Array} classes - Array of classes from portal. Null if error.
  */

function parseIcalClasses(data, callback) {
	if(typeof callback !== 'function') return;

	if(typeof data !== 'object') {
		callback(new Error('Invalid iCal object!'), null, null);
		return;
	}

	var classes = {};

	// Go through each event and add to classes object with a count of how many times they occur
	for(var eventUid in data) {
		var calEvent = data[eventUid];

		if(typeof calEvent.summary !== 'string') continue;

		var start = moment(calEvent['start']);
		var end   = moment(calEvent['end']);

		var startDay = start.clone().startOf('day');
		var endDay = end.clone().startOf('day');

		// Check if it's an all-day event
		if(start.isSame(startDay) && end.isSame(endDay)) {
			continue;
		}

		var className = calEvent.summary.trim();

		if(typeof classes[className] !== 'undefined') {
			classes[className]++;
		} else {
			classes[className] = 1;
		}
	}

	var uniqueClasses = Object.keys(classes);
	var filteredClasses = [];

	for(var i = 0; i < uniqueClasses.length; i++) {
		var uniqueClass = uniqueClasses[i];
		var occurences = classes[uniqueClass];

		// Remove all class names containing a certain keyword
		var classKeywordBlacklist = [
			'US'
		];

		if(occurences >= 10) {

			// Check if class contains any word blacklisted
			var containsBlacklistedWord = false;
			for(var j = 0; j < classKeywordBlacklist.length; j++) {
				if(uniqueClass.includes(classKeywordBlacklist[j])) {
					containsBlacklistedWord = true;
					break;
				}
			}

			// If doesn't contain keyword, push to array
			if(!containsBlacklistedWord) {
				filteredClasses.push(uniqueClass);
			}
		}
	}

	callback(null, true, filteredClasses);
}

/**
 * Cleans up the silly event titles we get from the portal
 * @function cleanUp
 *
 * @param {string} str - Summary to clean up
 * @returns {string}
 */

function cleanUp(str) {
	if(typeof str !== 'string') return str;
	return str.replace(cleanUpBlockSuffix, '');
}

/**
 * Get students that belongs to the same portal class
 * @function getUsersInClass
 *
 * @param {Object} db - Database object
 * @param {string} user - Username
 * @param {getUsersInClassCallback} callback - callback containing class information
 */
/**
 * @callback getUsersInClassCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Array} classes - Object containing an array of users in the class
 */
function findClassesByUser(db, user, callback) {
	if (typeof db !== 'object') return callback(new Error('db connection incorrect'), null);
	if (typeof user !=='string') return callback(new Error('user info incorrect'), null);

	var userClass = db.collection('usersClass');
	var result = {};
	// find all the portal classes that contains the user name
	userClass.find({ user: user }).toArray(function(err, attendingClasses) {
		if (err) {
			callback(new Error(err), null);
			return;
		}

		result = attendingClasses.map(function(userClassDoc) {
			// find all the other users in the same portal classes
			userClass.find({ classStr: userClassDoc.classStr }).toArray(function(err, classmates) {
				if (err) {
					callback(new Error(err), null);
					return;
				}

				return {
					classStr: userClassDoc.classStr,
					classmates: classmates.map(function(userClassDoc) {
						users.get(db, userClassDoc.username, function(user) {
							return user;
						});
					})
				};
			});
		});

		callback(null, result);
	});
}

// RegEx
module.exports.validDayRotation   = validDayRotation;
module.exports.portalSummaryBlock = portalSummaryBlock;

// Constants
module.exports.portalRange = portalRange;

// Functions
module.exports.verifyURL       = verifyURL;
module.exports.setURL          = setURL;
module.exports.getCal          = getCal;
module.exports.getDayRotation  = getDayRotation;
module.exports.getDayRotations = getDayRotations;
module.exports.getClasses      = getClasses;
module.exports.cleanUp         = cleanUp;
module.exports.findClassesByUser = findClassesByUser;
