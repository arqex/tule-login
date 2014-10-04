'use strict';

var config = require('config'),
	passport = require('passport')
;

var defaultSettings = {

};

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
			}
		};

		hooks.addFilter('settings:get:routes:static', function(routes){
			console.log( 'inited' );
			routes.push({url: 'tulelogin', path: 'tulelogin/r'});
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

		var loginMiddleware = require('./login-middleware'),
			middlewareManager = require( config.path.modules + '/middleware/middlewareManager')
		;

		hooks.filter( 'middleware', 10, function( handlers ){
			console.log( 'Handlers' );
			console.log( handlers );
			var index = middlewareManager.getMiddlewareIndex( 'session' );

			handlers.splice( index+1, 0, { name: 'tule-login', handler: loginMiddleware.middleware });



			return handlers;
		});

		hooks.on( 'settings:ready', function(){

			var settings = config.require( 'settings' ),
				collectionName = 'collection_' + config.tulelogin.userCollection
			;

			loginMiddleware.init();

			settings.get( config.tulelogin.settingsName )
				.then(function( options ){
					updateSettings( options );
				})
			;

			// Check users collection
			settings.get( collectionName )
				.then( function( collectionSetting ){
					if( collectionSetting )
						return;

					// Create user definition
					settings.save( collectionSetting, {
						propertyDefinitions:[
							{key: 'username', label: 'Username', datatype: {id: 'string'}},
							{key: 'password', label: 'Password', datatype: {id: 'string'}},
							{key: 'email', label: 'Email', datatype: {id: 'string'}},
							{key: 'active', label: 'Active', datatype: {id: 'boolean'}},
						],
						headerFields: [ 'username', 'password', 'email', 'active' ],
						mandatoryProperties: [],
						hiddenProperties: [],
						customProperties: true
					});
				})
			;

			// Update settings on save
			hooks.on( 'settings:save:' + config.tulelogin.settingsName, updateSettings );
		});

		/*
		hooks.addFilter('settings:get:tulelogin:observers', function( observers ){
			observers.push('../tulelogin/frontendObserver');
			return observers;
		});
		*/
	}
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