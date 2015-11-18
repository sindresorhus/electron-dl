'use strict';
const electron = require('electron');

require('.')();

electron.app.on('ready', () => {
	(new electron.BrowserWindow({})).loadURL('https://github.com/sindresorhus/caprine/releases/tag/0.2.1');
});
