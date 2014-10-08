'use strict';

var config = require('config'),
	settings = config.require('settings'),
	log = require('winston'),
	passport = require('passport'),
	_ = require( 'underscore' ),
	fs = require('fs'),
	log = require('winston')
;

var renderForm = function( error, username, res ) {
		settings.get('assetsUrl')
			.then( function( url ){
				fs.readFile(
					config.path.plugins + '/tule-login/login.html',
					'utf8',
					function( err, contents ){
						var html = _.template( contents, {message: error, username: username, assetsUrl: url}),
							code = error ? 403 : 200
						;
						res.send(code, html);
					}
				);
			})
		;
	}
;

module.exports = {
	checkLogin: function( req, res ){
		res.send(1);
	},
	login: function( req, res ){
		var error = req.session.redirect ? 'The url is protected, please log in.' : '';
		renderForm( error, '', res );
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
				var redirectUrl = req.session.redirect,
					authenticate = passport.authenticate( 'local', function( err, user ){
						if (err) {
							return renderForm( 'There was an unexpected error.', req.body.username, res);
						}
						if (!user) {
							return renderForm( 'Wrong username or password.', req.body.username, res);
						}

						req.logIn( user, function( err ){
							if( err )
								return renderForm( 'There was an unexpected error.', req.body.username, res);
							log.info( 'User ' + req.body.username + ' authenticated.');

							// If there is a stored page
							if(req.session.redirect) {
								url = req.session.redirect;
								delete req.session.redirect;
							}

							res.redirect( redirectUrl || url );
						});
					})
				;

				authenticate( req, res );
			})
			.catch( function( err ){
				log.error( err );
				return renderForm( 'There was an unexpected error.', req.body.username, res);
			})
		;
	}
};