'use strict';
const path = require('path');
const electron = require('electron');
const app = electron.app;

module.exports = () => {
	app.on('browser-window-created', (e, win) => {
		win.webContents.session.on('will-download', (e, item) => {
			const totalBytes = item.getTotalBytes();

			item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()));

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
			});
		});
	});
};
