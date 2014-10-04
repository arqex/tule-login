'use strict';

var config = require('config'),
	passport = require( 'passport' ),
	LocalStrategy = require( 'passport-local').Strategy,
	db, dbsettings
;

var settings = config.tulelogin.settings,
	activeUsers = false,
	apiUrl = config.tule.apiUrl,
	Users
;

function init() {
	// Initialize variables
	db = config.require( 'qdb' );
	dbsettings = config.require( 'settings' );
	Users = db( config.tulelogin.userCollection );

	checkActiveUsers();

	//Update login url
	getLoginUrl();

	passport.use( new LocalStrategy( checkLogin ) );

	passport.serializeUser( function( user, done ){
		done( null, user._id );
	});

	passport.deserializeUser( function( id, done ){
		Users.findOne({_id: id})
			.then( function( user ){
				done( null, user );
			})
			.catch( function( err ){
				done( err );
			})
		;
	});
}

function getLoginUrl() {
	dbsettings.get('apiUrl')
		.then( function( url ){
			apiUrl = url;
		})
	;

	return apiUrl + config.tulelogin.urls.login;
}

function checkActiveUsers() {
	return Users.findOne({active:true})
		.then( function( user ){
			if( user )
				activeUsers = true;
			return activeUsers;
		})
	;
}

function checkLogin( username, pass, done ){
	Users.findOne({username: username})
		.then( function( user ){
			if( !user )
				return done( null, false );

			if ( !validPassword( user, pass ) )
				return done( null, false );

			return done( null, user );
		})
	;
}

function validPassword( user, pass ){
	return user.password == pass;
}

function isAuthEnabled() {
	// Check the active users for the next request
	checkActiveUsers();

	return activeUsers && settings.enabled;
}

function middleware(req, res, next) {
	if( !isAuthEnabled )
		next();

	var initMiddleware = passport.initialize(),
		sessionMiddleWare = passport.session()
	;

	// Execute middleware
	initMiddleware( req, res, function(){
		sessionMiddleWare( req, res, function(){
			var loginUrl = getLoginUrl();

			if( req.isAuthenticated() || req.url == loginUrl )
				return next();

			res.redirect( loginUrl );
		});
	});
}

module.exports = {
	init: init,
	middleware: middleware
};