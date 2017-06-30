'use strict';
const electron = require('electron');
const minimist = require('minimist');
const samples = require('./lib/samples');
const server = require('./lib/server');

require('.')();

const argv = minimist(process.argv.slice(2));

electron.app.on('ready', () => {
	server();

	const win = new electron.BrowserWindow();
	win.webContents.session.enableNetworkEmulation({
		latency: 2,
		downloadThroughput: 1024 * 1024
	});

	const numSampleFiles = ('files' in argv ? argv.files : 5);
	samples.setup(numSampleFiles)
		.then(files => {
			win.loadURL(`http://localhost:8080/index.html?files=${JSON.stringify(files)}`);
		});

	win.on('closed', samples.teardown);
});

process.on('SIGINT', samples.teardown);
