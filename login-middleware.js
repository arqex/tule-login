'use strict';

var config = require('config'),
	passport = require( 'passport' ),
	LocalStrategy = require( 'passport-local').Strategy,
	bcrypt = require('bcryptjs'),
	Q = require('q'),
	logger = require( 'winston' ),
	Path = require('path'),
	db, dbsettings
;

var activeUsers = false,
	apiUrl = config.tule.apiUrl,
	allowedUrls = [],
	updatingUrls = false,
	Users, hooks
;

function init( hooksObj ) {
	hooks = hooksObj;

	// Initialize variables
	db = config.require( 'qdb' );
	dbsettings = config.require( 'settings' );
	Users = db( config.tulelogin.userCollection );

	updateAllowedUrls();

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


var apiUrl = config.tule.apiUrl;
function getApiUrl() {
	dbsettings.get('apiUrl')
		.then( function( url ){
			apiUrl = url;
		})
	;

	return apiUrl;
}

function getLoginUrl() {
	return apiUrl + '/' + config.tulelogin.urls.login;
}

function checkActiveUsers() {
	return Users.findOne({active:true})
		.then( function( user ){
			activeUsers = !!user;
			return activeUsers;
		})
	;
}

function checkLogin( username, pass, done ){
	Users.findOne({username: username})
		.then( function( user ){
			if( !user )
				return done( null, false );

			return validPassword( user, pass )
				.then( function( auth ){
					return done( null, auth ? user : false );
				})
			;
		})
		.catch( function( err ){
			logger.error( err );
		})
	;
}

function validPassword( user, pass ){
	return Q.nfcall( bcrypt.compare.bind(bcrypt), pass, user.password );
}

function isAuthEnabled() {
	// Check the active users for the next request
	checkActiveUsers();

	return activeUsers;
}

function isProtectedUrl( url ){
	var protectedUrl = false,
		protectedUrls = config.tulelogin.protectedAccess,
		i = 0,
		current
	;

	updateAllowedUrls();

	// Allowed urls have preference
	for(; i<allowedUrls.length; i++){
		if( url.slice(0, allowedUrls[i].length) == allowedUrls[i] )
			return false;
	}

	i = 0;
	while( !protectedUrl && i < protectedUrls.length ) {
		current = protectedUrls[i++];
		protectedUrl = url.slice(0, current.length) == current;
	}

	return protectedUrl;
}

function updateAllowedUrls() {
	if( updatingUrls )
		return;

	updatingUrls = hooks.filter('allowedUrls', config.tulelogin.allowedAccess )
		.then( function( urls ){
			updatingUrls = false;
			if( Array.isArray(urls) )
				allowedUrls = urls;
		})
	;
}

function middleware(req, res, next) {
	if( !isAuthEnabled() )
		return next();

	var initMiddleware = passport.initialize(),
		sessionMiddleWare = passport.session()
	;

	// Execute middleware
	initMiddleware( req, res, function(){
		sessionMiddleWare( req, res, function(){
			var loginUrl = getLoginUrl();

			if( req.isAuthenticated() || req.url == loginUrl || !isProtectedUrl(req.url) )
				return next();

			// Save redirect url for the login
			var apiUrl = getApiUrl();
			if( req.url != loginUrl && !Path.extname(req.url) && req.url.slice(0, apiUrl.length) != apiUrl )
				req.session.redirect = req.url;

			res.redirect( loginUrl );
		});
	});
}

function hash( password ) {
	return Q.nfcall( bcrypt.hash.bind(bcrypt), password, config.tulelogin.cypher.rounds );
}

module.exports = {
	init: init,
	middleware: middleware,
	hash: hash
};