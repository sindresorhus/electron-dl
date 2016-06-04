'use strict';
const path = require('path');
const electron = require('electron');
const app = electron.app;

function registerListener(win, opts = {}) {
	const listener = (e, item, webContents) => {
		const totalBytes = item.getTotalBytes();
		const filePath = path.join(app.getPath('downloads'), item.getFilename());

		item.setSavePath(filePath);

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
				electron.dialog.showErrorBox('Download error', `The download of ${item.getFilename()} was interrupted`);
			}

			if (state === 'completed') {
				if (process.platform === 'darwin') {
					app.dock.downloadFinished(filePath);
				}

				if (opts.unregisterWhenDone) {
					webContents.session.removeListener('will-download', listener);
				}
			}
		});
	};

	win.webContents.session.on('will-download', listener);
}

module.exports = () => {
	app.on('browser-window-created', (e, win) => {
		registerListener(win);
	});
};

module.exports.download = (win, url) => {
	registerListener(win, {unregisterWhenDone: true});
	win.webContents.downloadURL(url);
};
