import { AliasType, Block, CanvasEvent, ClassType, DefaultCanvasClass } from '@mymicds/sdk';
import * as ical from 'ical';
import { Db, ObjectID } from 'mongodb';
import * as prisma from 'prisma';
import * as querystring from 'querystring';
import request from 'request-promise-native';
import * as _ from 'underscore';
import * as url from 'url';
import * as aliases from './aliases';
import * as checkedEvents from './checkedEvents';
import { MyMICDSClassWithIDs } from './classes';
import * as feeds from './feeds';
import * as htmlParser from './htmlParser';
import * as users from './users';

// URL Calendars come from
const urlPrefix = 'https://micds.instructure.com/feeds/calendars/';

/**
 * Makes sure a given url is valid and it points to a Canvas calendar feed
 * @function verifyURL
 *
 * @param {string} canvasURL - URI to iCal feed
 * @callback {verifyURLCallback} callback - Callback
 */

/**
 * Returns whether url is valid or not
 * @callback verifyURLCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Boolean|string} isValid - True if valid URL, string describing problem if not valid. Null if error.
 * @param {string} url - Valid and formatted URL to our likings. Null if error or invalid url.
 */

export async function verifyURL(canvasURL: string) {
	if (typeof canvasURL !== 'string') { throw new Error('Invalid URL!'); }

	// Parse URL first
	const parsedURL = url.parse(canvasURL);

	// Check if pathname is valid
	if (!parsedURL.pathname || !parsedURL.pathname.startsWith('/feeds/calendars/')) {
		// Not a valid URL!
		return { isValid: 'Invalid URL path!', url: null };
	}

	const pathParts = parsedURL.path!.split('/');
	const userCalendar = pathParts[pathParts.length - 1];

	const validURL = urlPrefix + userCalendar;

	// Not lets see if we can actually get any data from here
	let response;
	try {
		response = await request(validURL, {
			resolveWithFullResponse: true,
			simple: false
		});
	} catch (e) {
		throw new Error('There was a problem fetching calendar data from the URL!');
	}

	if (response.statusCode !== 200) { return { isValid: 'Invalid URL!', url: null }; }

	return { isValid: true, url: validURL };
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

export async function setURL(db: Db, user: string, calUrl: string) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }

	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	const { isValid, url: validURL } = await verifyURL(calUrl);
	if (isValid !== true) { return { isValid, validURL: null }; }

	const userdata = db.collection('users');

	try {
		await userdata.updateOne({ _id: userDoc!._id }, { $set: { canvasURL: validURL } }, { upsert: true });
	} catch (e) {
		throw new Error('There was a problem updating the URL to the database!');
	}

	await feeds.updateCanvasCache(db, user);

	return { isValid: true, validURL };
}

/**
 * Retrieves a user's events on Canvas from their URL
 * @function getUserCal
 *
 * @param {Object} db - Database connection
 * @param {string} user - Username to get schedule
 * @param {getUserCalCallback} callback - Callback
 */

/**
 * Returns a user's schedule for that day
 * @callback getUserCalCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Boolean} hasURL - Whether user has set a valid portal URL. Null if failure.
 * @param {Object} events - Array of all the events in the month. Null if failure.
 */

export async function getUserCal(db: Db, user: string) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }

	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	if (typeof userDoc!.canvasURL !== 'string') { return { hasURL: false, events: null }; }

	let response;
	try {
		response = await request(userDoc!.canvasURL!, {
			resolveWithFullResponse: true,
			simple: false
		});
	} catch (e) {
		throw new Error('There was a problem fetching canvas data from the URL!');
	}
	if (response.statusCode !== 200) { throw new Error('Invalid URL!'); }

	return { hasURL: true, events: Object.values<CanvasCalendarEvent>(ical.parseICS(response.body)) };
}

/**
 * Parses a Canvas assignment title into class name and teacher's name.
 * @function parseCanvasTitle
 *
 * @param {string} title - Canvas assignment title
 * @returns {Object}
 */

function parseCanvasTitle(title: string) {
	const classTeacherRegex = /\[.+]/g;
	const teacherRegex = /:[A-Z]{5}$/g;
	const firstLastBrackets = /(^\[)|(]$)/g;

	// Get what's in the square brackets, including square brackets
	const classTeacher = _.last(Array.from(title.match(classTeacherRegex)!)) || '';
	const classTeacherNoBrackets = classTeacher.replace(firstLastBrackets, '');
	// Subtract the class/teacher from the Canvas title
	const assignmentName = title.replace(classTeacherRegex, '').trim();

	// Also check if there's a teacher, typically separated by a colon
	const teacher = (_.last(classTeacherNoBrackets.match(teacherRegex)!) || '').replace(/^:/g, '');
	const teacherFirstName = teacher[0] || '';
	const teacherLastName = (teacher[1] || '') + teacher.substring(2).toLowerCase();

	// Subtract teacher from classTeacher to get the class
	const className = classTeacher.replace(teacher, '').replace(/\[|]/g, '').replace(/:$/g, '');

	return {
		assignment: assignmentName,
		class: {
			raw: classTeacherNoBrackets,
			name: className,
			teacher: {
				raw: teacher,
				firstName: teacherFirstName,
				lastName: teacherLastName
			}
		}
	};
}

/**
 * Parses a Canvas calendar link into an assignment/event link.
 * @function calendarToEvent
 *
 * @param {string} calLink - Calendar link
 * @returns {string}
 */

function calendarToEvent(calLink: string) {
	// Example calendar link:
	// https://micds.instructure.com/calendar?include_contexts=course_XXXXXXX&month=XX&year=XXXX#assignment_XXXXXXX
	// 'assignment' can also be 'calendar_event'
	const calObject = url.parse(calLink);

	const courseId = (querystring.parse(calObject.query!).include_contexts as string).replace('_', 's/');

	// Remove hash sign and switch to event URL format
	const eventString = calObject.hash!.slice(1);
	let eventId;
	if (eventString.includes('assignment')) {
		eventId = eventString.replace('assignment_', 'assignments/');
	} else if (eventString.includes('calendar_event')) {
		eventId = eventString.replace('calendar_event_', 'calendar_events/');
	}

	return 'https://micds.instructure.com/' + courseId + '/' + eventId;
}

/**
 * Iterates through all of the user's events and get their classes from Canvas
 * @function getClasses
 *
 * @param {Object} db - Database object
 * @param {string} user - Username
 * @param {getClassesCallback} callback - Callback
 */

/**
 * Returns array of classes from canvas
 * @callback getClassesCallback
 *
 * @param {Object} err - Null if success, error object if failure
 * @param {Boolean} hasURL - Whether or not user has a Canvas URL set. Null if error.
 * @param {Array} classes - Array of classes from canvas. Null if error or no Canvas URL set.
 */

export async function getClasses(db: Db, user: string) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }
	if (typeof user !== 'string') { throw new Error('Invalid username!'); }

	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	if (typeof userDoc!.canvasURL !== 'string') { return { hasURL: false, classes: null }; }

	function parseEvents(eventsToParse: CanvasCacheEvent[]) {
		const classes: string[] = [];

		for (const calEvent of eventsToParse) {
			// If event doesn't have a summary, skip
			if (typeof calEvent.summary !== 'string') { continue; }

			const parsedEvent = parseCanvasTitle(calEvent.summary);

			// If not already in classes array, push to array
			if (parsedEvent.class.raw.length > 0 && !_.contains(classes, parsedEvent.class.raw)) {
				classes.push(parsedEvent.class.raw);
			}
		}

		return { hasURL: true, classes };
	}

	const canvasdata = db.collection<CanvasCacheEvent>('canvasFeeds');

	let events;
	try {
		events = await canvasdata.find({ user: userDoc!._id }).toArray();
	} catch (e) {
		throw new Error('There was an error retrieving Canvas events!');
	}

	// If cache is empty, update it
	if (events.length > 0) {
		return parseEvents(events);
	} else {
		await feeds.updateCanvasCache(db, user);

		let retryEvents;
		try {
			retryEvents = await canvasdata.find({ user: userDoc!._id }).toArray();
		} catch (e) {
			throw new Error('There was an error retrieving Canvas events!');
		}

		return parseEvents(retryEvents);
	}
}

/**
 * Get Canvas events from the cache
 * @param {Object} db - Database object
 * @param {string} user - Username
 * @param {getFromCacheCallback} callback - Callback
 */

/**
 * Returns array containing Canvas events
 * @callback getFromCacheCallback
 *
 * @param {Object} err - Null if success, error object if failure
 * @param {Boolean} hasURL - Whether or not user has a Canvas URL set. Null if error.
 * @param {Array} events - Array of events if success, null if failure.
 */

export async function getFromCache(db: Db, user: string) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }
	if (typeof user !== 'string') { throw new Error('Invalid username!'); }

	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	if (typeof userDoc!.canvasURL !== 'string') { return { hasURL: false, events: null }; }

	const canvasdata = db.collection<CanvasCacheEvent>('canvasFeeds');

	let events;
	try {
		events = await canvasdata.find({ user: userDoc!._id }).toArray();
	} catch (e) {
		throw new Error('There was an error retrieving Canvas events!');
	}

	// Get which events are checked
	const checkedEventsList = await checkedEvents.list(db, user);

	// Loop through all of the events in the calendar feed and push events within month to validEvents
	const validEvents: CanvasEvent[] = [];
	// Cache class aliases
	const classAliases: { [name: string]: DefaultCanvasClass | MyMICDSClassWithIDs } = {};

	// Function for getting class to insert according to canvas name
	async function getCanvasClass(parsedEvent: ReturnType<typeof parseCanvasTitle>) {
		const name = parsedEvent.class.raw;

		// Check if alias is already cached
		if (typeof classAliases[name] !== 'undefined') {
			return classAliases[name];
		}

		// Query aliases to see if possible class object exists
		const { hasAlias, classObject: aliasClass } = await aliases.getClass(db, user, AliasType.CANVAS, name);

		// Backup object if Canvas class doesn't have alias
		const defaultColor = '#34444F';
		const canvasClass: DefaultCanvasClass = {
			_id: null,
			canvas: true,
			user,
			name: parsedEvent.class.name,
			teacher: {
				_id: null,
				prefix: '',
				firstName: parsedEvent.class.teacher.firstName,
				lastName: parsedEvent.class.teacher.lastName
			},
			type: ClassType.OTHER,
			block: Block.OTHER,
			color: defaultColor,
			textDark: prisma.shouldTextBeDark(defaultColor)
		};

		if (hasAlias) {
			classAliases[name] = aliasClass as MyMICDSClassWithIDs;
		} else {
			classAliases[name] = canvasClass;
		}

		return classAliases[name];
	}

	for (const canvasEvent of events) {
		const parsedEvent = parseCanvasTitle(canvasEvent.summary);

		// Check if alias for class first
		const canvasClass = await getCanvasClass(parsedEvent);
		const start = new Date(canvasEvent.start);
		const end = new Date(canvasEvent.end);

		// class will be null if error in getting class name.
		const insertEvent: any = {
			_id: canvasEvent.uid,
			canvas: true,
			user: userDoc!.user,
			class: canvasClass,
			title: parsedEvent.assignment,
			start,
			end,
			link: calendarToEvent(canvasEvent.url) || '',
			checked: _.contains(checkedEventsList, canvasEvent.uid)
		};

		if (typeof canvasEvent['ALT-DESC'] === 'object') {
			insertEvent.desc = canvasEvent['ALT-DESC']!.val;
			insertEvent.descPlaintext = htmlParser.htmlToText(insertEvent.desc);
		} else {
			insertEvent.desc = '';
			insertEvent.descPlaintext = '';
		}

		validEvents.push(insertEvent as CanvasEvent);
	}

	return { hasURL: true, events: validEvents };
}

export interface CanvasCalendarEvent {
	type: 'VEVENT';
	params: string[]; // empty
	description?: string;
	end: Date;
	dtstamp: string;
	start: Date;
	class: 'PUBLIC';
	location?: string;
	sequence: '0';
	summary: string;
	uid: string;
	url: string;
	'ALT-DESC'?: {
		params: {
			FMTTYPE: 'text/html'
		},
		val: string
	};
}

export interface CanvasCalendarWithUser extends CanvasCalendarEvent {
	user: ObjectID;
}

export interface CanvasCacheEvent extends CanvasCalendarWithUser {
	_id: ObjectID;
}