import Port from './port';

export default class Client extends Port {
	constructor(options) {

		super(window.parent, '*', options);

		this.lastHeight = 0;

	}
	connect() {
		var me = this;
		return new Promise((resolve) => {
			me.open();
			super.connect();
			resolve(me.request('hello', me.id));
		});
	}
	navigate(url) {
		this.sendEvent('navigate', url);
	}
	setTitle(title) {
		this.sendEvent('title', title);
	}
}
