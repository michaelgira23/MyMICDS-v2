'use strict';

/**
 * @file Main file of the whole project.
 */

try {
	var config = require(__dirname + '/libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

var port = process.env.PORT || config.port;

/*
 * General Libraries
 */

var bodyParser  = require('body-parser');
var cors        = require('cors');
var http        = require('http');
var jwt         = require(__dirname + '/libs/jwt.js');
var lunch       = require(__dirname + '/libs/lunch.js');
var mail        = require(__dirname + '/libs/mail.js');
var MongoClient = require('mongodb').MongoClient;
var request     = require('request');
var weather     = require(__dirname + '/libs/weather.js');

/*
 * Frameworks
 */

var express = require('express');
var app = express();
var server = http.Server(app);

/**
 * Express Middleware
 */

// Enable Cross-origin Resource Sharing
app.use(cors());

// Body Parser for POST Variables
app.use(bodyParser.json());     // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
	extended: true
}));

/*
 * Realtime Stuff
 */

// Socket.io
var io = require('socket.io')(server);
var socketIO = require(__dirname + '/libs/socket.io.js')(io);

// Miscellaneous stuff
require(__dirname + '/libs/realtime.js')(io, socketIO);

/*
 * Routes
 */

require(__dirname + '/routes/assets.js')(app, express);

// Connect to database
MongoClient.connect(config.mongodb.uri, function(err, db) {
	if(err) throw err;

	// Enable JWT authentication middleware
	app.use(jwt.authorize(db));
	app.use(jwt.fallback);
	app.use(jwt.catchUnauthorized);

	// API Routes
	require(__dirname + '/routes/aliasAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/backgroundAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/bulletinAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/canvasAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/classAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/datesAPI.js')(app);
	require(__dirname + '/routes/loginAPI.js')(app, db);
	require(__dirname + '/routes/lunchAPI.js')(app, db);
	require(__dirname + '/routes/modulesAPI.js')(app, db);
	require(__dirname + '/routes/plannerAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/portalAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/quotesAPI.js')(app, db);
	require(__dirname + '/routes/scheduleAPI.js')(app, db)
	require(__dirname + '/routes/snowdayAPI.js')(app, db);
	require(__dirname + '/routes/sportsAPI.js')(app);
	require(__dirname + '/routes/statsAPI.js')(app, db);
	require(__dirname + '/routes/suggestionAPI.js')(app, db);
	require(__dirname + '/routes/teacherAPI.js')(app, db);
	require(__dirname + '/routes/userAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/weatherAPI.js')(app, db, socketIO);
	require(__dirname + '/routes/notesAPI.js')(app, db);
});

app.get('/start', function(req, res) {
	res.sendFile(__dirname + '/html/start.html');
});

app.get('/socket-io-test', function(req, res) {
	res.sendFile(__dirname + '/html/socket.html');
});

app.get('/spin', function(req, res) {
	res.sendFile(__dirname + '/html/spin.html');
});

/*
 * Initialize Server
 */

server.listen(port, function() {
	console.log('Server listening on *:' + port);
});
