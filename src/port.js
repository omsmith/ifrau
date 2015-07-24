const uuid = require('uuid');

import PROTOCOL from './protocol';

let typeNameValidator = /^[a-zA-Z]+[a-zA-Z\-]*$/;

export default class Port {
	constructor(endpoint, targetOrigin, options) {
		options = options || {};
		this.debugEnabled = options.debug || false;
		this.endpoint = endpoint;
		this.eventHandlers = {};
		this.isConnected = false;
		this.isOpen = false;
		this.pendingRequests = {};
		this.requestHandlers = {};
		this.services = {};
		this.targetOrigin = targetOrigin;
		this.waitingRequests = [];

		this.id = uuid();
		this.requestCounter = 0;
	}
	close() {
		if(!this.isOpen) {
			throw new Error('Port cannot be closed, call open() first');
		}
		this.isOpen = false;
		this.isConnected = false;
		window.removeEventListener('message', this.receiveMessage);
		this.debug('closed');
	}
	connect() {
		this.isConnected = true;
		this.debug('connected');
		return this;
	}
	debug(msg) {
		if(this.debugEnabled) {
			console.log(msg);
		}
	}
	getService(serviceType, version) {
		if(!this.isConnected) {
			throw new Error('Cannot getService() before connect() has completed');
		}
		let serviceVersionPrefix = `service:${serviceType}:${version}`;
		let me = this;
		function createProxyMethod(name) {
			return function() {
				let args = [`${serviceVersionPrefix}:${name}`];
				for(let i=0; i<arguments.length; i++) {
					args.push(arguments[i]);
				}
				return me.requestRaw.apply(me, args);
			};
		}
		function createProxy(methodNames) {
			let proxy = {};
			methodNames.forEach((name) => {
				proxy[name] = createProxyMethod(name);
			});
			return proxy;
		}
		return me.requestRaw(serviceVersionPrefix).then(createProxy);
	}
	initHashArrAndPush(dic, key, obj) {
		if(dic[key] === undefined ) {
			dic[key] = [];
		}
		dic[key].push(obj);
	}
	onEvent(eventType, handler) {
		if(this.isConnected) {
			throw new Error('Add event handlers before connecting');
		}
		this.debug(`onEvent handler added for "${eventType}"`);
		this.initHashArrAndPush(this.eventHandlers, eventType, handler);
		return this;
	}
	onRequest(requestType, handler) {
		if(this.isConnected) {
			throw new Error('Add request handlers before connecting');
		}
		if(this.requestHandlers[requestType] !== undefined) {
			throw new Error(`Duplicate onRequest handler for type "${requestType}"`);
		}
		this.debug(`onRequest handler added for "${requestType}"`);
		this.requestHandlers[requestType] = handler;
		this.sendRequestResponse(requestType);
		return this;
	}
	open() {
		if(this.isOpen) {
			throw new Error('Port is already open.');
		}
		this.isOpen = true;
		window.addEventListener('message', this.receiveMessage.bind(this), false);
		this.debug('opened');
		return this;
	}
	receiveMessage(e) {
		if(!Port.validateEvent(this.targetOrigin, this.endpoint, e)) {
			return;
		}

		const type = e.data.type;
		const key = e.data.key;

		this.debug(`received message: ${type}.${key}`);

		switch (type) {
			case PROTOCOL.MESSAGE_TYPES.EVENT: {
				this.receiveEvent(key, e.data.payload);
				break;
			}
			case PROTOCOL.MESSAGE_TYPES.REQUEST: {
				this.receiveRequest(key, e.data.payload);
				break;
			}
			case PROTOCOL.MESSAGE_TYPES.RESPONSE: {
				this.receiveRequestResponse(key, e.data.payload);
				break;
			}
			default: {
				this.debug(`received unknown message type: ${type}`);
			}
		}
	}
	receiveEvent(eventType, payload) {
		if(this.eventHandlers[eventType] === undefined) {
			return;
		}
		this.eventHandlers[eventType].forEach(function(handler) {
			handler.apply(handler, payload);
		});
	}
	receiveRequest(requestType, payload) {
		this.initHashArrAndPush(this.waitingRequests, requestType, payload);
		this.sendRequestResponse(requestType);
	}
	receiveRequestResponse(requestType, payload) {

		var requests = this.pendingRequests[requestType];
		if(requests === undefined) {
			return;
		}

		for(var i=0; i<requests.length; i++) {
			var req = requests[i];
			if(req.id !== payload.id) {
				continue;
			}
			req.promise(payload.val);
			requests.splice(i, 1);
			return;
		}

	}
	registerService(serviceType, version, service) {
		if(this.isConnected) {
			throw new Error('Register services before connecting');
		}
		if(!typeNameValidator.test(serviceType)) {
			throw new Error(`Invalid service type "${serviceType}"`);
		}
		let methodNames = [];
		for(let p in service) {
			if(typeof(service[p]) === 'function') {
				methodNames.push(p);
				this.onRequest(`service:${serviceType}:${version}:${p}`, service[p]);
			}
		}
		this.onRequest(`service:${serviceType}:${version}`, methodNames);
		return this;
	}
	request() {
		if(!this.isConnected) {
			throw new Error('Cannot request() before connect() has completed');
		}
		return this.requestRaw.apply(this, arguments);
	}
	requestRaw(requestType) {
		var args = [];
		for(var i=1; i<arguments.length; i++) {
			args.push(arguments[i]);
		}
		var me = this;
		return new Promise((resolve, reject) => {
			const id = `${me.id}_${++me.requestCounter}`;
			me.initHashArrAndPush(
					me.pendingRequests,
					requestType,
					{
						id: id,
						promise: resolve,
					}
				);
			me.sendMessage(PROTOCOL.MESSAGE_TYPES.REQUEST, requestType, {id: id, args: args});
		});
	}
	sendMessage(type, key, data) {
		const message = {
			protocol: PROTOCOL.NAME,
			version: PROTOCOL.VERSION,
			type: type,
			key: key,
			payload: data
		};
		this.debug(`sending message: ${type}.${key}`);
		this.endpoint.postMessage(message, this.targetOrigin);
		return this;
	}
	sendEvent(eventType) {
		if(!this.isConnected) {
			throw new Error('Cannot sendEvent() before connect() has completed');
		}
		var args = [];
		for(var i=1; i<arguments.length; i++) {
			args.push(arguments[i]);
		}
		return this.sendEventRaw(eventType, args);
	}
	sendEventRaw(eventType, data) {
		return this.sendMessage(PROTOCOL.MESSAGE_TYPES.EVENT, eventType, data);
	}
	sendRequestResponse(requestType) {

		var handler = this.requestHandlers[requestType];
		var waiting = this.waitingRequests[requestType];
		delete this.waitingRequests[requestType];

		if(handler === undefined || waiting === undefined || waiting.length === 0) {
			return;
		}

		var me = this;

		waiting.forEach(function(w) {
			var handlerResult = handler;
			if(typeof(handler) === 'function') {
				handlerResult = handler.apply(handler, w.args);
			}
			Promise
				.resolve(handlerResult)
				.then((val) => {
					me.sendMessage(PROTOCOL.MESSAGE_TYPES.RESPONSE, requestType, { id: w.id, val: val });
				});
		});

	}
	static validateEvent(targetOrigin, endpoint, e) {
		var isValid = (e.source === endpoint) &&
			(targetOrigin === '*' || targetOrigin === e.origin) &&
			(e.data.protocol === PROTOCOL.NAME) &&
			(e.data.version === PROTOCOL.VERSION);

		return isValid;
	}
}
