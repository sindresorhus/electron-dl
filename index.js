'use strict';
const path = require('path');
const electron = require('electron');
const unusedFilename = require('unused-filename');

const app = electron.app;

function registerListener(win, opts = {}, cb = () => {}) {
	const listener = (e, item, webContents) => {
		const totalBytes = item.getTotalBytes();
		const dir = opts.directory || app.getPath('downloads');
		const filePath = unusedFilename.sync(path.join(dir, item.getFilename()));

		if (!opts.saveAs) {
			item.setSavePath(filePath);
		}

		// TODO: use mime type checking for file extension when no extension can be inferred
		// item.getMimeType()

		item.on('updated', () => {
			win.setProgressBar(item.getReceivedBytes() / totalBytes);
		});

		item.on('done', (e, state) => {
			if (!win.isDestroyed()) {
				win.setProgressBar(-1);
			}

			if (state === 'interrupted') {
				const message = `The download of ${item.getFilename()} was interrupted`;
				electron.dialog.showErrorBox('Download error', message);
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
