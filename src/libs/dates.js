'use strict';

/**
 * @file Wish I had one
 * @module dates
 */

var _      = require('underscore');
var moment = require('moment');
var portal = require(__dirname + '/portal.js');

/**
 * Returns a Moment.js object the date and time school is going to end
 * Based on two consecutive years, we have gather enough data and deeply analyzed that the last day of school is _probably_ the last Friday of May.
 * @function lastFridayMay
 * @param {Number} year - Which May to get last Friday from
 * @returns {Object}
 */

function lastFridayMay(year) {
	var current = moment();
	if(typeof year !== 'number' || year % 1 !== 0) {
		year = current.year();
	}

	var lastDayOfMay = moment().year(year).month('May').endOf('month').startOf('day').hours(11).minutes(30);

	/*
	 * Fun fact: This is literally the only switch statement in the whole MyMICDS codebase.
	 */

	switch(lastDayOfMay.day()) {
		case 5:
			// If day is already Friday
			var lastDay = lastDayOfMay;
		case 6:
			// Last day is Sunday
			var lastDay = lastDayOfMay.subtract(1, 'day');
		default:
			// Subtract day of week (which cancels it out) and start on Saturday.
			// Then subtract to days to get from Saturday to Friday.
			var lastDay = lastDayOfMay.subtract(lastDayOfMay.day() + 2, 'days');
	}

	return lastDay;
}

/**
 * Returns a Moment.js object when the next last day of school is.
 * Based on two consecutive years, we have gather enough data and deeply analyzed that the last day of school is _probably_ the last Friday of May.
 * @function schoolEnds
 * @returns {Object}
 */

function schoolEnds() {
	var current = moment();
	var lastDayThisYear = lastFridayMay();

	if(lastDayThisYear.isAfter(current)) {
		return lastDayThisYear;
	} else {
		return lastFridayMay(current.year() + 1);
	}
}

/**
 * Returns an array containing the school years of a given date
 * @function getSchoolYear
 * @param {Object} date - Date object
 * @returns {Object}
 */

function getSchoolYear(date) {
	date = moment(date);
	var lastDayThisYear = lastFridayMay(date.year());

	// If after summer, include next year. Otherwise, include last year
	if(date.isAfter(lastDayThisYear)) {
		return [date.year(), date.year() + 1];
	} else {
		return [date.year() - 1, date.year()];
	}
}

/**
 * Returns the upcoming breaks and long weekends within the next 12 months
 * @function getDaysOff
 * @callback {getDaysOffCallback} callback - Callback
 */

/**
 * Returns an object of upcoming breaks and long weekends
 * @callback getDaysOffCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Object} breaks - Object of breaks. Null if failure.
 */

function getDaysOff(callback) {
	if(typeof callback !== 'function') {
		return;
	}

	portal.getDayRotations(function(err, days) {
		if(err) {
			callback(err, null);
			return;
		}

		var dayPointer = moment().startOf('day').subtract(portal.portalRange.previous, 'months');
		var dayMax = moment().startOf('day').add(portal.portalRange.upcoming, 'months');

		// Array of moment.js objects which we have a day off
		var daysOff = [];

		// Go through all days
		while(dayPointer.isSameOrBefore(dayMax)) {

			// Check if there's no rotation day and that it isn't the weekend
			if(!(days[dayPointer.year()] && days[dayPointer.year()][dayPointer.month() + 1] && days[dayPointer.year()][dayPointer.month() + 1][dayPointer.date()])) {
				daysOff.push(dayPointer.clone());
			}

			dayPointer.add(1, 'day');
		}

		callback(null, daysOff);
	});
}

/**
 * Returns the user's breaks according to days off
 * @function getBreaks
 * @param {getBreaksCallback} callback - Callback
 */

/**
 * Returns an object with different properties containing moment dates
 * @callback getBreaksCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Object} breaks - Object containing breaks. Null if error.
 */

function getBreaks(callback) {
	if(typeof callback !== 'function') {
		return;
	}

	// Get array of days that have no day rotation
	getDaysOff(function(err, days) {
		if(err) {
			callback(err, null);
			return;
		}

		// Group days off into arrays
		var i = 0;
		var groupedDays = days.reduce(function(stack, b) {
			var cur = stack[i];
			var a = cur ? cur[cur.length - 1] : 0;

			if(b - a > 86400000) {
				i++;
			}

			if (!stack[i]) {
				stack[i] = [];
			}

			stack[i].push(b);

			return stack;

		}, [])
		// For some reason first element is always undefined or something
		groupedDays.shift();

		/*
		 * Categorize breaks
		 *
		 * Weekends - Breaks that are exclusively Saturday and Sunday
		 * Long Weekends - Breaks that include Saturday and Sunday. Can include weekdays but cannot be more than a week (7 days).
		 * Vacations - Breaks that are more than a week (7 days).
		 * Other - For some reason if there's a day off in the middle of the week.
		 */

		var categorizedBreaks = {
			weekends: [],
			longWeekends: [],
			vacations: [],
			other: []
		};

		console.log('grouped ays', groupedDays);
		for(var j = 0; j < groupedDays.length; j++) {
			var group = groupedDays[j];

			// Check if weekend
			if(group.length === 2 && group[0].day() === 6 && group[1].day() === 0) {
				categorizedBreaks.weekends.push({
					start: group[0],
					end: group[group.length - 1]
				});
				continue;
			}

			// Check if Saturday / Sunday are included in break
			var weekendIncluded = false;
			for(var k = 0; k < group.length; k++) {
				if(group[k].day() === 6 || group[k].day() === 0) {
					weekendIncluded = true;
					continue;
				}
			}

			if(weekendIncluded) {
				if(group.length < 7) {
					categorizedBreaks.longWeekends.push({
						start: group[0],
						end: group[group.length - 1]
					});
				} else {
					categorizedBreaks.vacations.push({
						start: group[0],
						end: group[group.length - 1]
					});
				}
			} else {
				categorizedBreaks.other.push({
					start: group[0],
					end: group[group.length - 1]
				});
			}

		}

		callback(null, categorizedBreaks);
	});
}

module.exports.lastFridayMay = lastFridayMay;
module.exports.schoolEnds    = schoolEnds;
module.exports.getSchoolYear = getSchoolYear;
module.exports.getBreaks     = getBreaks;
