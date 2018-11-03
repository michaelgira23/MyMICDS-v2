/*
 * This is where all of our sensitive information is stored.
 * DO NOT MODIFY THIS DOCUMENT. Instead, create a 'config.js' with the filled out information.
 */

// tslint:disable:max-line-length
export default {
	port: 1420,
	hostedOn: 'http://localhost:1420', // URL to access this server. Used for signing JWT's
	production: false, // Whether or not the server is running in production mode. (This enables/disables a few features!)

	email: {
		URI      : '',
		fromEmail: 'support@mymicds.net',
		fromName : 'MyMICDS Support'
	},

	forecast: {
		APIKey: ''
	},

	jwt: {
		secret: 'flexvimsans'
	},

	mongodb: {
		uri: '',
		dbName: ''
	},

	portal: {
		dayRotation: '' // Student Calendar > My Calendar from Veracross
	},

	ramsArmy: {
		user: 'support@mymicds.net',
		pass: ''
	},

	googleServiceAccount: {
		type: 'service_account',
		project_id: '',
		private_key_id: '',
		private_key: '',
		client_email: '',
		client_id: '',
		auth_uri: 'https://accounts.google.com/o/oauth2/auth',
		token_uri: 'https://accounts.google.com/o/oauth2/token',
		auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
		client_x509_cert_url: ''
	}
};