'use strict';

var config = require('config'),
	logger = require('winston'),
	Q = require('q')
;

var settings, db, loginMiddleware;

module.exports = {
	init: function(hooks){

		config.tulelogin = {
			path: config.path.plugins + '/tule-login/',
			rUrl: config.tule.baseUrl + 'r/tulelogin/',
			userCollection: 'users',
			settingsName: 'tulelogin-settings',
			settings: {},
			urls: {
				login: 'login',
				logout: 'logout'
			},
			cypher: {
				rounds: 10
			}
		};

		hooks.addFilter('settings:get:routes:static', function(routes){
			console.log( 'inited' );
			routes.push({url: 'tulelogin', path: 'tule-login/r'});
			return routes;
		});


		hooks.addFilter('settings:get:routes:server', function(routes){

			//The splice is necessary to add the route before the default one.
			routes.splice(-1, 0,
				{route: 'get::/' + config.tulelogin.urls.login , controller: '/tule-login/controllers/loginController::login'},
				{route: 'get::/' + config.tulelogin.urls.logout , controller: '/tule-login/controllers/loginController::logout'},
				{route: 'post::/' + config.tulelogin.urls.login , controller: '/tule-login/controllers/loginController::authenticate'}
			);
			return routes;
		});

		hooks.addFilter('settings:get:routes:client', function(routes){
			//The splice is necessary to add the route before the default one.
			routes.splice(-1, 0,
				{route: 'tulelogin', controller:  config.tulelogin.rUrl + 'controllers/settingsController.js'}
			);
			return routes;
		});

		hooks.addFilter('settings:get:navigation:items', function(items){
			items.Login = [
				{text: 'Login Settings', url: '/tulelogin'}
			];
			return items;
		});

		loginMiddleware = require('./login-middleware');
		var middlewareManager = require( config.path.modules + '/middleware/middlewareManager')
		;

		console.log( 'Login middleware ...');
		hooks.addFilter( 'middleware', -10, function( handlers ){
			var index = middlewareManager.getMiddlewareIndex( 'session', handlers );

			handlers.splice( index + 1, 0, { name: 'tule-login', handler: loginMiddleware.middleware });

			console.log( 'Handlers' );
			console.log( handlers );

			return handlers;
		});

		hooks.on( 'settings:ready', function(){

			// Initialize db variables
			settings = config.require( 'settings' );
			db = config.require( 'qdb' );

			// Init login middleware
			loginMiddleware.init();

			// Cache the settings
			settings.get( config.tulelogin.settingsName )
				.then(function( options ){
					updateSettings( options );
				})
			;

			// Check users collection
			checkUserCollection();

			// Update settings on save
			hooks.on( 'settings:save:' + config.tulelogin.settingsName, updateSettings );
		});

		hooks.addFilter('settings:get:frontend:observers', function( observers ){
			observers.push('../tulelogin/loginObserver');
			return observers;
		});

		hooks.addFilter( 'document:find:users:results', function( users ){
			if( users && users.length ) {
				users.forEach( function(u) {
					u.newpassword = '';
					u.confirmpassword = '';
				});
			}

			return users;
		});

		hooks.addFilter( 'document:findOne:users:results', function( user ){
			if( user ) {
				user.newpassword = '';
				user.confirmpassword = '';
			}

			return user;
		});

		hooks.addFilter( 'document:save:users:args', function( args ){
			var doc = args[0];

			return updatePassword( doc )
				.then( function(){
					return args;
				})
			;
		});

		hooks.addFilter( 'document:insert:users:args', function( args ){
			var users = args[0],
				result = Q(1)
			;

			if( !Array.isArray(users) )
				users = [args[0]];

			users.forEach(function( u ){
				result = result.then( loginMiddleware.hash.bind( null, u.password ) )
					.then( function( hash ){
						u.password = hash;
					})
				;
			});

			return result.then(function(){
				return args;
			});
		});

		hooks.addFilter( 'document:update:users:args', function( args ){
			var doc = args[1];

			if( doc.$set )
				return args;

			return updatePassword( doc )
				.then( function(){
					return args;
				})
			;
		});
	}
};

var updatePassword = function( doc ) {
	if( (doc.newpassword || doc.confirmpassword) && doc.newpassword == doc.confirmpassword ) {
		return loginMiddleware.hash( doc.newpassword )
			.then( function( hash ){
				doc.password = hash;

				delete doc.newpassword;
				delete doc.confirmpassword;

				return doc;
			})
		;
	}

	delete doc.newpassword;
	delete doc.confirmpassword;
	return doc;
};

/**
 * Update the settings preserving the same setting object
 * @param  {Object} newSettings New settings.
 */
var updateSettings = function( newSettings ) {
	if( !newSettings )
		return;
	var options = config.tulelogin.settings;

	// Delete old properties
	Object.keys( options ).forEach( function( key ){
		delete options[ key ];
	});

	// Set the new ones
	for( var key in newSettings )
		options[key] = newSettings[key];
};

var checkUserCollection = function() {
	var collectionName = 'collection_' + config.tulelogin.userCollection;

	settings.get( collectionName )
		.then( function( collectionSetting ){
			if( collectionSetting ) {
				return;
			}

			// Create user definition
			var settingsDb = config.require( 'db' ).getInstance('settings');
			settingsDb.collection( config.tule.settingsCollection ).save(
				{
					name: collectionName,
					collectionName: config.tulelogin.userCollection,
					propertyDefinitions:[
						{key: 'username', label: 'Username', datatype: {id: 'string'}},
						{key: 'password', label: 'Password', datatype: {id: 'string'}},
						{key: 'email', label: 'Email', datatype: {id: 'string'}},
						{key: 'active', label: 'Active', datatype: {id: 'bool'}},
						{key: 'newpassword', label: 'New Password', datatype: {id: 'password'}},
						{key: 'confirmpassword', label: 'Confirm Password', datatype: {id: 'password'}},
					],
					headerFields: [ 'username', 'email' ],
					mandatoryProperties: [ 'username', 'password', 'email', 'active' ],
					hiddenProperties: [ 'password' ],
					customProperties: true
				},
				function( err ){
					if( err )
						console.error( new Error('Could not create the user collection settings.') );
					else
						logger.debug( 'User collection settings created.' );
				}
			);
		})
	;

	// Creates users collection if it doesn't exist
	db().createCollection( config.tulelogin.userCollection )
		.then( function(){
			logger.debug( 'User collection created' );
		})
	;
};