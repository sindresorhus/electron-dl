'use strict';
const path = require('path');
const electron = require('electron');
const unusedFilename = require('unused-filename');
const pupa = require('pupa');

const app = electron.app;

function registerListener(win, opts = {}, cb = () => {}) {
	const listener = (e, item, webContents) => {
		const totalBytes = item.getTotalBytes();
		const dir = opts.directory || app.getPath('downloads');
		const filePath = unusedFilename.sync(path.join(dir, item.getFilename()));
		const errorMessage = opts.errorMessage || 'The download of {filename} was interrupted';
		const errorTitle = opts.errorTitle || 'Download Error';

		if (!opts.saveAs) {
			item.setSavePath(filePath);
		}

		// TODO: use mime type checking for file extension when no extension can be inferred
		// item.getMimeType()

		item.on('updated', () => {
			const ratio = item.getReceivedBytes() / totalBytes;
			win.setProgressBar(ratio);

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

				if (opts.unregisterWhenDone) {
					webContents.session.removeListener('will-download', listener);
				}

				cb(null, item);
			}
		});
	};

	win.webContents.session.on('will-download', listener);
}

module.exports = (opts = {}) => {
	app.on('browser-window-created', (e, win) => {
		registerListener(win, opts);
	});
};

module.exports.download = (win, url, opts) => new Promise((resolve, reject) => {
	opts = Object.assign({}, opts, {unregisterWhenDone: true});
	registerListener(win, opts, (err, item) => err ? reject(err) : resolve(item));
	win.webContents.downloadURL(url);
});
