'use strict';

var events = require('./events');

module.exports = function userActivityClient(client) {
	function actOnUserActivity() {
		client.sendEvent(events.ACTIVITY_EVENT);
	}

	function startListeningForUserActivity() {
		document.addEventListener('click', actOnUserActivity);
		document.addEventListener('keydown', actOnUserActivity);
	}

	function stopListeningForUserActivity() {
		document.removeEventListener('click', actOnUserActivity);
		document.remoteEventListener('keydown', actOnUserActivity);
	}

	client
		.onEvent(events.LISTEN_FOR_ACTIVITY_EVENT, startListeningForUserActivity)
		.onEvent(events.STOP_LISTENING_FOR_ACTIVITY_EVENT, stopListeningForUserActivity);
};
