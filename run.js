import process from 'node:process';
import {
	app,
	BrowserWindow,
	BaseWindow,
	WebContentsView,
} from 'electron';
import minimist from 'minimist';
import {setup, teardown} from './lib/samples.js';
import server from './lib/server.js';
import electronDl, {download} from './index.js';

electronDl();

const argv = minimist(process.argv.slice(2));

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
	await app.whenReady();

	server();

	const win = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
		},
	});

	win.on('closed', teardown);

	win.webContents.session.enableNetworkEmulation({
		latency: 2,
		downloadThroughput: 1024 * 1024,
	});

	const numberSampleFiles = 'files' in argv ? argv.files : 5;
	const files = await setup(numberSampleFiles);
	await win.loadURL(`http://localhost:8080/index.html?files=${JSON.stringify(files)}`);

	// Test 1
	await download(BrowserWindow.getFocusedWindow(), 'https://google.com');

	// Test 2
	const win2 = new BaseWindow({width: 800, height: 400});
	const view = new WebContentsView();
	win2.contentView.addChildView(view);
	await view.webContents.loadURL('https://electronjs.org');
	await download(view, 'https://google.com');
})();

process.on('SIGINT', teardown);
