'use strict';
const path = require('path');
const electron = require('electron');
const unusedFilename = require('unused-filename');
const pupa = require('pupa');

const app = electron.app;
const shell = electron.shell;

function registerListener(session, opts = {}, cb = () => {}) {
	const listener = (e, item, webContents) => {
		let hostWebContents = webContents;
		if (webContents.getType() === 'webview') {
			hostWebContents = webContents.hostWebContents;
		}

		const win = electron.BrowserWindow.fromWebContents(hostWebContents);
		const totalBytes = item.getTotalBytes();
		const dir = opts.directory || app.getPath('downloads');
		let filePath;

		if (opts.filename) {
			filePath = path.join(dir, opts.filename);
		} else {
			filePath = unusedFilename.sync(path.join(dir, item.getFilename()));
		}

		const errorMessage = opts.errorMessage || 'The download of {filename} was interrupted';
		const errorTitle = opts.errorTitle || 'Download Error';

		if (!opts.saveAs) {
			item.setSavePath(filePath);
		}

		item.on('updated', () => {
			const ratio = item.getReceivedBytes() / totalBytes;
			if (!win.isDestroyed()) {
				win.setProgressBar(ratio);
			}

			if (typeof opts.onProgress === 'function') {
				opts.onProgress(ratio);
			}
		});

		item.on('done', (e, state) => {
			if (!win.isDestroyed()) {
				win.setProgressBar(-1);
			}

			if (state === 'interrupted') {
				const message = pupa(errorMessage, {filename: item.getFilename()});
				electron.dialog.showErrorBox(errorTitle, message);
				cb(new Error(message));
			} else if (state === 'completed') {
				if (process.platform === 'darwin') {
					app.dock.downloadFinished(filePath);
				}

				if (opts.openFolderWhenDone) {
					shell.showItemInFolder(filePath);
				}

				if (opts.unregisterWhenDone) {
					session.removeListener('will-download', listener);
				}

				cb(null, item);
			}
		});
	};

	session.on('will-download', listener);
}

module.exports = (opts = {}) => {
	app.on('session-created', session => {
		registerListener(session, opts);
	});
};

module.exports.download = (win, url, opts) => new Promise((resolve, reject) => {
	opts = Object.assign({}, opts, {unregisterWhenDone: true});

	registerListener(win.webContents.session, opts, (err, item) => {
		if (err) {
			reject(err);
		} else {
			resolve(item);
		}
	});

	win.webContents.downloadURL(url);
});
