'use strict';
const path = require('path');
const electron = require('electron');
const unusedFilename = require('unused-filename');
const pupa = require('pupa');

const app = electron.app;
const shell = electron.shell;

function registerListener(session, opts = {}, cb = () => {}) {
	let downloadItems = {};
	const activeDownloadItems = () => Object.keys(downloadItems).filter(key => downloadItems[key].receivedBytes !== downloadItems[key].totalBytes).length;
	const progressDownloadItems = () => {
		const sumReceivedBytes = Object.keys(downloadItems).reduce((receivedBytes, key) => { receivedBytes += downloadItems[key].receivedBytes }, 0);
		const sumTotalBytes = Object.keys(downloadItems).reduce((totalBytes, key) => { totalBytes += downloadItems[key].totalBytes }, 0);
		return sumReceivedBytes / sumTotalBytes;
	};

	const listener = (e, item, webContents) => {
		let hostWebContents = webContents;
		if (webContents.getType() === 'webview') {
			hostWebContents = webContents.hostWebContents;
		}
		const win = electron.BrowserWindow.fromWebContents(hostWebContents);

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
			downloadItems[item.getStartTime()] = {
				receivedBytes: item.getReceivedBytes(),
				totalBytes: item.getTotalBytes()
			};

			if (['darwin', 'linux'].indexOf(process.platform) >= 0) {
				app.setBadgeCount(activeDownloadItems());
			}

			if (!win.isDestroyed()) {
				win.setProgressBar(progressDownloadItems());
			}

			if (typeof opts.onProgress === 'function') {
				opts.onProgress(progressDownloadItems());
			}
		});

		item.on('done', (e, state) => {
			if (['darwin', 'linux'].indexOf(process.platform) >= 0) {
				app.setBadgeCount(activeDownloadItems());
			}

			if (!win.isDestroyed() && !activeDownloadItems()) {
				win.setProgressBar(-1);
				downloadItems = {};
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
