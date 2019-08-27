import * as fs from 'fs-extra';
import * as path from 'path';
import * as _ from 'underscore';
import config from './config';
import * as utils from './utils';
import moment from 'moment';

import { promisify } from 'util';

// TODO: Refactor this file so that the google-batch module is not needed.
// It's not compatible with more recent versions of googleapis that have TypeScript and Promise support built in.
// This would allow us to get rid of all the `any` types here and replace them with defined types from googleapis.
import googleBatch from 'google-batch';
import * as googleServiceAccount from './googleServiceAccount';

const google = googleBatch.require('googleapis');
const gmail  = google.gmail('v1');

// Where public accesses backgrounds
export const baseURL = config.hostedOn + '/daily-bulletin';
// Where to save Daily Bulletin PDFs
const bulletinPDFDir = __dirname + '/../public/daily-bulletin';
// Query to retrieve emails from Gmail
const query = 'label:us-daily-bulletin';

/**
 * Retrieves the most recent Daily Bulletin from Gmail and saves it to the bulletin directory.
 */
export async function queryLatest() {
	// Get Google Service Account
	const jwtClient = await googleServiceAccount.create();

	// Get list of messages
	let messageList;
	try {
		messageList = await promisify(gmail.users.messages.list)({
			auth: jwtClient,
			userId: 'me',
			q: query
		});
	} catch (e) {
		throw new Error('There was a problem listing the messages from Gmail!');
	}

	// Get the most recent email id
	const recentMsgId = messageList.messages[0].id;

	// Now get details on most recent email
	let recentMessage;
	try {
		recentMessage = await promisify(gmail.users.messages.get)({
			auth: jwtClient,
			userId: 'me',
			id: recentMsgId
		});
	} catch (e) {
		throw new Error('There was a problem getting the most recent email!');
	}

	// Search through the email for any PDF
	const parts = recentMessage.payload.parts;
	let attachmentId: string | null = null;
	let originalFilename: path.ParsedPath | null = null;
	for (const part of parts) {
		// If part contains PDF attachment, we're done boys.
		if (part.mimeType === 'application/pdf' || part.mimeType === 'application/octet-stream') {
			attachmentId = part.body.attachmentId;
			originalFilename = path.parse(part.filename);
			break;
		}
	}

	if (attachmentId === null) {
		throw new Error('The most recent Daily Bulletin email did not contain any PDF attachment!');
	}

	// Get PDF attachment with attachment id
	let attachment;
	try {
		attachment = await promisify(gmail.users.messages.attachments.get)({
			auth: jwtClient,
			userId: 'me',
			messageId: recentMsgId,
			id: attachmentId
		});
	} catch (e) {
		throw new Error('There was a problem getting the PDF attachment!');
	}

	// PDF Contents
	const pdf = Buffer.from(attachment.data, 'base64');
	// Get PDF name
	const bulletinName = generateFilename(originalFilename!.name, new Date(parseInt(recentMessage.internalDate, 10)));

	// If bulletinName is null, we are unable to parse bulletin and should skip
	// This probably means it's not a bulletin
	if (!bulletinName) { return; }

	// Make sure directory for Daily Bulletin exists
	try {
		await fs.ensureDir(bulletinPDFDir);
	} catch (e) {
		throw new Error('There was a problem ensuring directory for Daily Bulletins!');
	}

	// Write PDF to file
	try {
		await fs.writeFile(bulletinPDFDir + '/' + bulletinName, pdf);
	} catch (e) {
		throw new Error('There was a problem writing the PDF!');
	}
}

/**
 * Gets every single Daily Bulletin and writes them to disk.
 */
export async function queryAll() {
	// tslint:disable:no-console
	console.log('Trying to query all the Daily Bulletins in existence. This may take a bit of time...');

	const jwtClient = await googleServiceAccount.create();

	// Array to store all message ids
	console.log('Get Daily Bulletin message ids...');
	let messageIds: any[] = [];

	async function getPage(nextPageToken?: string) {
		const listQuery = {
			auth: jwtClient,
			userId: 'me',
			maxResults: 200,
			q: query
		};
		if (typeof nextPageToken === 'string') {
			(listQuery as any).pageToken = nextPageToken;
		}

		let messageList;
		try {
			messageList = await promisify(gmail.users.messages.list)(listQuery);
		} catch (e) {
			throw new Error('There was a problem listing the messages from Gmail!');
		}

		// Add message ids to array
		messageIds = messageIds.concat(messageList.messages);

		// If there is a next page, get it
		if (typeof messageList.nextPageToken === 'string') {
			console.log('Get next page with token ' + messageList.nextPageToken);
			await getPage(messageList.nextPageToken);
		} else {
			// We got all the pages!
			// We start with the last so newer bulletins will override older ones if multiple emails were sent.
			// Create a batch so we can send up to 100 requests at once
			// noinspection JSPotentiallyInvalidConstructorUsage
			const batch = new googleBatch();
			batch.setAuth(jwtClient);

			// Array to store all the email information
			let getMessages: any[] = [];

			console.log('Get detailed information about messages...');

			let inFirstBatch = 0;
			for (const messageId of messageIds.reverse()) {
				const params = {
					googleBatch: true,
					userId: 'me',
					id: messageId
				};

				batch.add(gmail.users.messages.get(params));
				inFirstBatch++;

				// If there are 100 queries in Batch request, query it.
				if (inFirstBatch === 100) {
					const responses = await promisify(batch.exec)();
					getMessages = getMessages.concat(responses);

					batch.clear();
					inFirstBatch = 0;
				}
			}

			// Finished making batch requests
			// Execute the remaining of the API requests in the batch
			const firstResponses = await promisify(batch.exec)();
			getMessages = getMessages.concat(firstResponses);
			batch.clear();
			console.log('Got ' + getMessages.length + ' emails containing Daily Bulletins');

			// Now that we're all done getting information about the email, make an array of all the attachments.
			const attachments = [];
			// Array containing filenames matching the indexes of the attachments array
			const attachmentIdFilenames = [];
			// Array containing dates matching the indexes of the attachments array
			const sentDates = [];

			// Search through the emails for any PDF
			for (const response of getMessages) {
				const parts = response.body.payload.parts;

				// Loop through parts looking for a PDF attachment
				for (const part of parts) {
					// If part contains PDF attachment, append attachment id and filename to arrays.
					if (part.mimeType === 'application/pdf' || part.mimeType === 'application/octet-stream') {
						const attachmentId = part.body.attachmentId;
						attachments.push({
							emailId: response.body.id,
							attachmentId
						});
						attachmentIdFilenames.push(part.filename);
						sentDates.push(new Date(parseInt(response.body.internalDate, 10)));
						break;
					}
				}
			}

			// Finally, make batch requests to get the actual PDF attachments
			console.log('Downloading Daily Bulletins...');
			let dailyBulletins: any[] = [];

			let inSecondBatch = 0;
			for (const attachment of attachments) {
				const params = {
					googleBatch: true,
					userId: 'me',
					messageId: attachment.emailId,
					id: attachment.attachmentId
				};

				batch.add(gmail.users.messages.attachments.get(params));
				inSecondBatch++;

				if (inSecondBatch === 100) {
					const responses = await promisify(batch.exec)();
					dailyBulletins = dailyBulletins.concat(responses);

					batch.clear();
					inSecondBatch = 0;
				}
			}

			// Finished getting attachments
			// Execute the remaining of the API requests in the batch
			const secondResponses = await promisify(batch.exec)();
			dailyBulletins = dailyBulletins.concat(secondResponses);
			batch.clear();

			// Finally, write all the Daily Bulletins to the proper directory
			console.log('Writing Daily Bulletins to file...');

			// Make sure directory for Daily Bulletin exists
			try {
				await fs.ensureDir(bulletinPDFDir);
			} catch (e) {
				throw new Error('There was a problem ensuring directory for Daily Bulletins!');
			}

			for (let i = 0; i < dailyBulletins.length; i++) {
				const dailyBulletin = dailyBulletins[i];
				// PDF contents
				const pdf = Buffer.from(dailyBulletin.body.data, 'base64');
				// We must now get the filename of the Daily Bulletin
				const originalFilename = path.parse(attachmentIdFilenames[i]);
				// Get PDF name
				const bulletinName = generateFilename(originalFilename.name, sentDates[i]);

				// If bulletinName is null, we are unable to parse bulletin and should skip
				// This probably means it's not a bulletin
				if (!bulletinName) { continue; }

				// Write PDF to file
				try {
					await fs.writeFile(bulletinPDFDir + '/' + bulletinName, pdf);
				} catch (e) {
					throw new Error('There was a problem writing the PDF!');
				}
			}

			console.log('Done!');
		}
	}
	// tslint:enable:no-console

	return getPage();
}

/**
 * Gets the locations of all the Daily Bulletins on disk.
 * @returns A list of bulletin filenames from newest to oldest.
 */
export async function getList() {
	// Read directory
	try {
		await fs.ensureDir(bulletinPDFDir);
	} catch (e) {
		throw new Error('There was a problem ensuring the bulletin directory exists!');
	}

	let files: string[];
	try {
		files = await fs.readdir(bulletinPDFDir);
	} catch (e) {
		throw new Error('There was a problem reading the bulletin directory!');
	}

	// Only return files that are a PDF
	const bulletins: string[] = [];
	for (const _file of files) {
		const file = path.parse(_file);
		if (file.ext === '.pdf') {
			bulletins.push(file.name);
		}
	}

	// Sort bulletins to get most recent
	bulletins.sort();
	bulletins.reverse();

	return bulletins;
}

/**
 * Turns an email attachment filename into a MyMICDS filename.
 * @param filename Email attachment filename.
 * @param sentDate Date when the email was sent.
 * @returns Filename to save bulletin as.
 */
function generateFilename(filename: string, sentDate: Date): string | null {
	let date;

	// Calise format
	const caliseFilename = /([0-9]+.)+[0-9]+/.exec(filename);
	if (!caliseFilename || !caliseFilename[0]) {
		// O'Brien format
		const obrienFilename = /[A-Za-z]+, ([A-Za-z]+) ([0-9]+)/.exec(filename);
		if (!obrienFilename) {
			return null;
		}

		date = moment(`${obrienFilename[1]} ${obrienFilename[2]}`, 'MMMM D').toDate();
	} else {
		date = new Date(caliseFilename[0]);
	}

	date.setFullYear(sentDate.getFullYear());

	if(_.isNaN(date.getTime())) {
		return null;
	}

	const [year, month, day] = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(utils.leadingZeros);

	return `${year}-${month}-${day}.pdf`;
}