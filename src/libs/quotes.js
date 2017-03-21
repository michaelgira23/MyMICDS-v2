'use strict';

/**
 * @file Functions for distributing our wisdom throughout the world. One API call at a time.
 * @module quotes
 */

/**
 * Get a quote from the database
 * @function getQuote
 *
 * @param {Object} db - Database connection
 * @param {getQuoteCallback} callback - Callback
 */

/**
 * Returns an array of quotes
 * @callback getQuoteCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {Object} quotes - Array of quotes from database. Null if error.
 */

function getQuotes(db, callback) {
	if(typeof callback !== 'function') return;

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'), null)
	}

	var quotesData = db.collection('quotes');

	quotesData.find({}).toArray(function(err, quotes) {
		if(err) {
			callback(new Error('There was a problem getting all the quotes from the database!'), null);
			return;
		}
		callback(null, quotes);
	});
}

/**
 * Disperses your knowledge into the universe
 * @function insertQuote
 *
 * @param {Object} db - Database connection
 * @param {string} author - Senpai
 * @param {string} quote - Words of wisdom we should all live by
 * @param {insertQuoteCallback} callback - Callback
 */

/**
 * Whether or not quote was successfully inserted into the database
 * @callback insertQuoteCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 */

function insertQuote(db, author, quote, callback) {
	if(typeof callback !== 'function') return;

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'));
		return;
	}

	if(typeof author !== 'string') {
		callback(new Error('Invalid author!'));
		return;
	}

	if(typeof quote !== 'string') {
		callback(new Error('Invalid quote!'));
		return;
	}

	var quotesData = db.collection('quotes');

	quotesData.insertOne({
		author: author,
		quote: quote
	}, function(err, result) {
		if(err) {
			callback(new Error('There was a problem inserting the quote into the database!'));
			return;
		}
		callback(null);
	});
}

module.exports.get = getQuotes;
module.exports.insert = insertQuote;
