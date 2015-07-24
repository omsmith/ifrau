var chai = require('chai'),
	expect = chai.expect,
	sinon = require('sinon')/*,
	resizer = require('iframe-resizer')*/;

chai.should();
chai.use(require('sinon-chai'));

import Host from '../src/host';

describe('host', () => {

	describe('constructor', () => {

		[
			undefined,
			null,
			'',
			'foo',
			'ftp://foo.com',
			'foo.com'
		].forEach((src) => {
			it(`should throw invalid origin "${src}"`, () => {
				expect(() => {
					var host = new Host(() => null, src);
				}).to.throw(Error, /Unable to extract origin/);
			});
		});

		it('should throw if parent missing', () => {
			expect(() => {
				var host = new Host(() => null, 'http://cdn.com/foo.html');
			}).to.throw(Error, /Could not find parent/);
		});

	});

	describe('methods', () => {

		let host, callback, onEvent, onRequest, sendEventRaw, element, resizerClose;

		beforeEach(() => {
			global.window = {
				addEventListener: sinon.stub(),
				location: { origin: 'origin' },
				removeEventListener: sinon.stub()
			};
			global.document = {
				createElement: sinon.stub().returns({style: {}, tagName: 'iframe'}),
				getElementById: sinon.stub().returns(),
				title: 'title',
				location: {
					href: 'url'
				}
			};
			callback = sinon.spy();
			element = { appendChild: sinon.spy() };
			host = new Host(() => element, 'http://cdn.com/app/index.html', callback);
			onEvent = sinon.spy(host, 'onEvent');
			onRequest = sinon.spy(host, 'onRequest');
			sendEventRaw = sinon.stub(host, 'sendEventRaw');
			resizerClose = sinon.stub(host.resizer, 'close');
		});

		afterEach(() => {
			onEvent.restore();
			onRequest.restore();
			sendEventRaw.restore();
			resizerClose.restore();
		});

		describe('close', () => {

			it('should close resizer', (done) => {
				host.connect().then(() => {
					host.close();
					resizerClose.should.have.been.calledWith(host.iframe);
					done();
				});
				host.receiveRequest('hello', 'foo');
			});

		});

		describe('connect', () => {

			it('should return a promise', () => {
				var p = host.connect();
				expect(p).to.be.defined;
				expect(p.then).to.be.defined;
			});

			it('should open the port', () => {
				host.connect();
				global.window.addEventListener.should.have.been.called;
			});

			it('should resolve promise when first "hello" request is received', (done) => {
				host.connect().then(() => done());
				host.receiveRequest('hello', 'foo');
			});

			it('should register for "hello" requests', () => {
				host.connect();
				onRequest.should.have.been.calledWith('hello');
			});

			['title', 'navigate'].forEach((evt) => {
				it(`should register for the "${evt}" event`, () => {
					host.connect();
					onEvent.should.have.been.calledWith(evt);
				});
			});

			it('should update the document title', () => {
				host.connect();
				host.receiveEvent('title', ['new title']);
				global.document.title.should.equal('new title');
			});

			it('should update the document location', () => {
				host.connect();
				host.receiveEvent('navigate', ['new url']);
				global.document.location.href.should.equal('new url');
			});

		});

	});

});
