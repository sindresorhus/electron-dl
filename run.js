'use strict';
const electron = require('electron');
const minimist = require('minimist');
const samples = require('./lib/samples');
const server = require('./lib/server');
const electronDl = require('.');

electronDl();

const argv = minimist(process.argv.slice(2));

(async () => {
	await electron.app.whenReady();

	server();

	const win = new electron.BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		}
	});

	win.on('closed', samples.teardown);

	win.webContents.session.enableNetworkEmulation({
		latency: 2,
		downloadThroughput: 1024 * 1024
	});

	const numSampleFiles = 'files' in argv ? argv.files : 5;
	const files = await samples.setup(numSampleFiles);
	await win.loadURL(`http://localhost:8080/index.html?files=${JSON.stringify(files)}`);
})();

process.on('SIGINT', samples.teardown);
