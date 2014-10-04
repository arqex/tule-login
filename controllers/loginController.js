'use strict';

var config = require('config'),
	settings = config.require('settings'),
	log = require('winston'),
	passport = require('passport'),
	_ = require( 'underscore' ),
	fs = require('fs')
;

var renderForm = function( error, username, res ) {
		settings.get('assetsUrl')
			.then( function( url ){
				fs.readFile(
					config.path.plugins + '/tule-login/login.html',
					'utf8',
					function( err, contents ){
						var html = _.template( contents, {message: error, username: username, assetsUrl: url});
						res.send(html);
					}
				);
			})
		;
	}
;

module.exports = {
	login: function( req, res ){
		renderForm( '', '', res );
	},

	logout: function( req, res ){

		req.logout();
		settings.get( 'baseUrl' )
			.then( function( url ){
				res.redirect(url);
			})
			.catch( function( err ){
				log.error( err );
				res.redirect('/');
			})
		;
	},

	authenticate: function( req, res ){
		settings.get( 'baseUrl' )
			.then( function( url ){
				passport.authenticate( 'local', function( err, user ){
					if (err) {
						return renderForm( 'There was an unexpected error.', req.body.username, res);
					}
					if (!user) {
						return renderForm( 'Wrong username or password.', req.body.username, res);
					}

					req.logIn( user, function( err ){
						if( err )
							return renderForm( 'There was an unexpected error.', req.body.username, res);
						res.redirect( url );
					});
				});
			})
			.catch( function( err ){
				log.error( err );
				return renderForm( 'There was an unexpected error.', req.body.username, res);
			})
		;
	}
};