var deps = [
	'underscore', 'jquery', 'backbone', 'events'
];

var settings;


define( deps, function( _, $, Backbone, Events ){
	'use strict';

	Events.on('menu:rendered', function(){

		// If the menu has been rendered this will be executed inmediatelly
		// and the settings var won't be available
		// wait for safety
		var $logout = $('<div class="tuleNav tule-logout"><a href="#">Log out</a></div>');
		$('#menuRegion').append( $logout );

		$logout.on('click', function(e){
			location.href = settings.url.api + '/logout';
		});

	});


	var checkLogin = function() {
		$.get( settings.url.api + '/checkLogin' )
			.fail( function( err ){
				if( err.status )
					location.reload();
			})
		;
	};

	Events.on('tule:route', checkLogin );

	return {
		init: function( settingsObject ){
			settings = settingsObject;
		}
	};
});