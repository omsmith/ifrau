var chai = require('chai'),
	expect = chai.expect,
	sinon = require('sinon');

chai.should();
chai.use(require('sinon-chai'));

import Client from '../src/client';

describe('client', () => {

	var client, callback, request, sendEvent, clock;

	beforeEach(() => {
		global.window = {
			addEventListener: sinon.stub(),
			parent: {
				postMessage: sinon.stub()
			}
		};
		global.document = {
			body: {
				scrollHeight: 100
			}
		};
		client = new Client();
		request = sinon.stub(client, 'request');
		sendEvent = sinon.stub(client, 'sendEvent');
		clock = sinon.useFakeTimers();
	});

	afterEach(() => {
		request.restore();
		sendEvent.restore();
		clock.restore();
	});

	describe('connect', () => {

		var open;

		beforeEach(() => {
			open = sinon.stub(client, 'open');
		});

		afterEach(() => {
			open.restore();
		});

		it('should return a promise', () => {
			var p = client.connect();
			expect(p).to.be.defined;
			expect(p.then).to.be.defined;
		});

		it('should open the port', () => {
			client.connect();
			open.should.have.been.called;
		});

		it('should send a "hello" request', () => {
			client.connect();
			request.should.have.been.calledWith('hello');
		});

	});

	describe('navigate', () => {

		it('should fire "navigate" event', (done) => {
			client.connect().then(() => {
				client.navigate('some-url');
				sendEvent.should.have.been.calledWith('navigate', 'some-url');
				done();
			});
		});

	});

	describe('setTitle', () => {

		it('should fire "title" event', (done) => {
			client.connect().then(() => {
				client.setTitle('my title');
				sendEvent.should.have.been.calledWith('title', 'my title');
				done();
			});
		});

	});

});
