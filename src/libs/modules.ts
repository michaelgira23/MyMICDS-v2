import { MyMICDSModule, MyMICDSModuleType } from '@mymicds/sdk';
import { Db, ObjectID } from 'mongodb';
import * as _ from 'underscore';
import * as users from './users';
import { StringDict } from './utils';

// Custom enum types
enum CountdownMode {
	TIME_OFF = 'TIME_OFF',
	START = 'START',
	END = 'END',
	VACATION = 'VACATION',
	LONG_WEEKEND = 'LONG_WEEKEND',
	WEEKEND = 'WEEKEND',
	CUSTOM = 'CUSTOM'
}

enum Color {
	GRAY = 'GRAY',
	ORANGE = 'ORANGE',
	PINK = 'PINK',
	TEAL = 'TEAL',
	WHITE = 'WHITE',
	YELLOW = 'YELLOW'
}

// Module options. Can be either `boolean`, `number`, or `string`
const modulesConfig: Partial<Record<MyMICDSModuleType, any>> = {
	[MyMICDSModuleType.BOOKMARKS]: {
		label: {
			type: String,
			default: 'Really Cool Site'
		},
		icon: {
			type: String,
			default: 'fa-bookmark'
		},
		url: {
			type: String,
			default: 'https://mymicds.net'
		}
	},
	[MyMICDSModuleType.COUNTDOWN]: {
		mode: {
			type: CountdownMode,
			default: CountdownMode.END
		},
		schoolDays: {
			type: Boolean,
			default: true
		},
		shake: {
			type: Boolean,
			default: true
		},
		countdownTo: {
			type: Date,
			optional: true,
			default: null
		},
		eventLabel: {
			type: String,
			optional: true,
			default: 'Countdown'
		}
	},
	[MyMICDSModuleType.PROGRESS]: {
		showDate: {
			type: Boolean,
			default: true
		}
	},
	[MyMICDSModuleType.STICKY_NOTES]: {
		color: {
			type: Color,
			default: Color.WHITE
		}
	},
	[MyMICDSModuleType.WEATHER]: {
		metric: {
			type: Boolean,
			default: false
		}
	}
};

// Range column indexes start at (inclusive)
const columnStarts = 0;
// Max number of columns
const columnsPerRow = 4;

// Range row indexes start at (inclusive)
const rowStarts = 0;

// Modules to give user if none found
const defaultModules: MyMICDSModule[] = [
	{
		type: MyMICDSModuleType.PROGRESS,
		row: 0,
		column: 0,
		width: columnsPerRow,
		height: 3,
		options: getDefaultOptions(MyMICDSModuleType.PROGRESS)
	},
	{
		type: MyMICDSModuleType.SCHEDULE,
		row: 3,
		column: 0,
		width: columnsPerRow / 2,
		height: 2
	},
	{
		type: MyMICDSModuleType.WEATHER,
		row: 3,
		column: columnsPerRow / 2,
		width: columnsPerRow / 2,
		height: 2,
		options: getDefaultOptions(MyMICDSModuleType.WEATHER)
	}
];

/**
 * Get default options of a module name
 * @param {string} type - Module type
 * @returns {Object}
 */

function getDefaultOptions(type: MyMICDSModuleType): any {
	const moduleConfig = modulesConfig[type as MyMICDSModuleType];
	if (typeof moduleConfig === 'undefined') {
		return {};
	}

	const defaults: StringDict = {};
	for (const optionKey of Object.keys(moduleConfig)) {
		defaults[optionKey] = moduleConfig[optionKey].default;
	}
	return defaults;
}

/**
 * Gets an array of all active modules for a user
 * @param {Object} db - Database connection
 * @param {string} user - Username
 * @param {getModulesCallback} callback - Callback
 */

/**
 * Callback after modules have been retrieved
 * @callback getModulesCallback
 *
 * @param {Object} err - Null if success, error object if failure
 * @param {Array} modules - Array of user's currently active modules if success, null ir error
 */

async function getModules(db: Db, user: string) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }
	if (typeof user !== 'string') { throw new Error('Invalid username!'); }

	// Check for user validity, get ID
	const { isUser, userDoc } = await users.get(db, user);

	// If user doesn't exist, return default modules
	if (!isUser) { return defaultModules; }

	const moduledata = db.collection<MyMICDSModuleWithIDs>('modules');

	const modules = await moduledata.find({ user: userDoc!._id }).toArray();

	if (modules) {
		for (const mod of modules) {
			const defaultOptions = getDefaultOptions(mod.type) || {};
			const defaultKeys = Object.keys(defaultOptions);

			// If config has no options, ignore recieved options
			if (_.isEmpty(defaultOptions)) {
				delete mod.options;
				continue;
			}

			mod.options = Object.assign({}, defaultOptions, mod.options);

			// Get rid of excess options
			for (const optionKey of Object.keys(mod.options!)) {
				if (!defaultKeys.includes(optionKey)) {
					delete mod.options![optionKey];
				}
			}

			if (_.isEmpty(mod.options)) {
				delete mod.options;
			}
		}
	}

	// Return default modules if none found, else return found documents
	return modules.length === 0 ? defaultModules : modules;
}

/**
 * Change a user's current modules
 * @param {Object} db - Database object
 * @param {String} user - Username
 * @param {Array} modules - List of modules with changes
 * @param {upsertModulesCallback} callback - Callback
 */

/**
 * Callback after modules are modified
 * @callback upsertModulesCallback
 *
 * @param {Object} err - Null if success, error object if null
 */

async function upsertModules(db: Db, user: string, modules: MyMICDSModule[]) {
	// Input validation
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }
	if (typeof user !== 'string') { throw new Error('Invalid username!'); }

	if (!_.isArray(modules)) { throw new Error('Modules is not an array!'); }
	if (!modules.every(m => Object.values(MyMICDSModuleType).includes(m.type))) {
		throw new Error('Invalid module type!');
	}

	for (const mod of modules) {
		const optionsConfig = modulesConfig[mod.type];

		// If no options config, delete any recieved module's options
		if (!optionsConfig) {
			delete mod.options;
			continue;
		}

		// If no options config (server-side), default to empty object
		if (!mod.options) {
			mod.options = {};
		}

		// Get list of all options configured
		const optionKeys = Object.keys(optionsConfig);

		// Remove any extra options
		for (const modOptionKey of Object.keys(mod.options!)) {
			if (!optionKeys.includes(modOptionKey)) {
				delete mod.options![modOptionKey];
			}
		}

		// Check that options are the right types. If not, use default value.
		for (const optionKey of optionKeys) {
			const configType = optionsConfig[optionKey].type;
			const optional = optionsConfig[optionKey].optional;

			const moduleValue = mod.options[optionKey];

			let valid = false;

			// Convert iso strings to date objects
			if (configType === Date) {
				mod.options[optionKey] = new Date(moduleValue);
				if (isNaN(mod.options[optionKey].getTime())) {
					valid = false;
				} else {
					valid = true;
				}
			} else if (!configType.prototype && Object.values(configType).includes(moduleValue)) {
				// Check if custom enum type
				valid = true;
			} else if (moduleValue instanceof configType) {
				// Check if native type
				valid = true;
			}

			if (!valid) {
				if (optional && (moduleValue === undefined || moduleValue === null)) {
					mod.options[optionKey] = null;
				} else {
					mod.options[optionKey] = optionsConfig[optionKey].default;
				}
			}
		}
	}
	if (!modules.every(m => m.width > 0)) { throw new Error('Modules must be at least 1 cell wide!'); }
	if (!modules.every(m => m.height > 0)) { throw new Error('Modules must be at least 1 cell tall!'); }

	if (!modules.every(m => (columnStarts <= m.column) && (m.column + m.width - columnStarts <= columnsPerRow))) {
		throw new Error(`Module column exceeds range between ${columnStarts} - ${columnsPerRow}!`);
	}
	if (!modules.every(m => (rowStarts <= m.row))) {
		throw new Error(`Module row below minimum value of ${rowStarts}!`);
	}

	// Check for user validity, get ID
	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	const moduleGrid: boolean[][] = [];

	for (const mod of modules) {
		for (let j = mod.row; j <= mod.row + mod.height - 1; j++) {
			if (typeof moduleGrid[j] !== 'object') { moduleGrid[j] = []; }

			for (let k = mod.column; k <= mod.column + mod.width - 1; k++) {
				if (moduleGrid[j][k]) { throw new Error('Modules overlap!'); }

				moduleGrid[j][k] = true;
			}
		}
	}

	const moduledata = db.collection<MyMICDSModuleWithIDs>('modules');

	// Delete all modules not included in new upsert request
	await moduledata.deleteMany({
		_id: { $nin: (modules as MyMICDSModuleWithIDs[]).map(m => new ObjectID(m._id)) },
		user: userDoc!._id
	});

	// Find all remaining modules so we know which id's are real or not
	const dbModules = await moduledata.find({ user: userDoc!._id }).toArray();

	const dbModuleIds = dbModules.map(m => m._id.toHexString());

	for (const mod of (modules as Array<MyMICDSModule & { _id: ObjectID | string }>)) {
		// If _id doesn't exist or is invalid, create a new one
		if (!mod._id || !dbModuleIds.includes(mod._id as string)) {
			mod._id = new ObjectID();
		} else {
			// Current id is valid. All we need to do is convert it to a Mongo id object
			mod._id = new ObjectID(mod._id);
		}

		// Make sure user is an ObjectID and not a string
		(mod as any).user = userDoc!._id;

		await moduledata.updateOne({ _id: mod._id, user: userDoc!._id }, { $set: mod }, { upsert: true });
	}
}

export interface MyMICDSModuleWithIDs extends MyMICDSModule {
	_id: ObjectID;
	user: ObjectID;
}

export {
	getModules as get,
	upsertModules as upsert
};