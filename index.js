'use strict';
const path = require('path');
const electron = require('electron');
const app = electron.app;

module.exports = () => {
	app.on('browser-window-created', (e, win) => {
		win.webContents.session.on('will-download', (e, item) => {
			const totalBytes = item.getTotalBytes();
			const filePath = path.join(app.getPath('downloads'), item.getFilename());

			item.setSavePath(filePath);

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
					// TODO: remove the `app.dock.downloadFinished` check sometime in the future
					if (process.platform === 'darwin' && app.dock.downloadFinished) {
						app.dock.downloadFinished(filePath);
					}
				}
			});
		});
	});
};
