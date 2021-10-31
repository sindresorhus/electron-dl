'use strict';
const path = require('path');
const { app, BrowserWindow, shell, dialog } = require('electron');
const unusedFilename = require('unused-filename');
const pupa = require('pupa');
const extName = require('ext-name');

const getFilenameFromMime = (name, mime) => {
	const extensions = extName.mime(mime);

	if (extensions.length !== 1) {
		return name;
	}

	return `${name}.${extensions[0].ext}`;
};

const downloadItems = new Map();

const activeDownloadItems = () => downloadItems.size;

function registerListener(session, options, callback = () => {}) {
	const progressDownloadItems = () => {
		const bytes = [...downloadItems].reduce(
			({ totalBytes, receivedBytes }, file) => {
				const [, { item }] = file;
				totalBytes += item.getTotalBytes();
				receivedBytes += item.getReceivedBytes();
				return {
					totalBytes,
					receivedBytes
				};
			}, { totalBytes: 0, receivedBytes: 0 }
		);

		return bytes.receivedBytes / bytes.totalBytes;
	};

	const listener = (event, item, webContents) => {
		// For some reason the 'will-download' event is triggered
		// more than once for certain items when downloading multiple files,
		// so this makes sure the item is "replace" with the last item,
		// this become useful on 'updated' event.
		if (downloadItems.has(item.getFilename())) {
			downloadItems.delete(item.getFilename());
		}

		// Setting the item with it's options for future references.
		// This avoids this bug found in electro-dl (https://github.com/sindresorhus/electron-dl/issues/83)
		// which reports the wrong progress when downloading multiple items
		// on item's 'updated' event.
		downloadItems.set(item.getFilename(), {
			options,
			item
		});

		let hostWebContents = webContents;
		if (webContents.getType() === 'webview') {
			({ hostWebContents } = webContents);
		}

		const window_ = BrowserWindow.fromWebContents(hostWebContents);

		const directory = options.directory || app.getPath('downloads');
		let filePath;
		if (options.filename) {
			filePath = path.join(directory, options.filename);
		} else {
			const filename = item.getFilename();
			const name = path.extname(filename) ? filename : getFilenameFromMime(filename, item.getMimeType());
			filePath = unusedFilename.sync(path.join(directory, name));
		}

		const errorMessage = options.errorMessage || 'The download of {filename} was interrupted';
		const errorTitle = options.errorTitle || 'Download Error';

		if (!options.saveAs) {
			item.setSavePath(filePath);
		}

		if (typeof options.onStarted === 'function') {
			options.onStarted(item);
		}

		item.on('updated', (event, state) => {
			const { options } = downloadItems.get(item.getFilename());

			if (state === 'progressing') {
				if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
					app.badgeCount = activeDownloadItems();
				}

				if (!window_.isDestroyed()) {
					window_.setProgressBar(progressDownloadItems());
				}

				if (typeof options.onProgress === 'function') {
					options.onProgress({
						percent: item.getTotalBytes() ? item.getReceivedBytes() / item.getTotalBytes() : 0,
						transferredBytes: item.getReceivedBytes(),
						totalBytes: item.getTotalBytes()
					});
				}
			} else if (state === 'interrupted') {
				// ---- NOT FULLY IMPLEMENTED ---
				// The download has interrupted and can be resumed.
				// Read: https://www.electronjs.org/docs/api/download-item#downloaditemresume
				callback(null, item);
			}
		});

		item.on('done', (event, state) => {
			downloadItems.delete(item.getFilename());

			// Apparently this only works on Mac and Linux/Unity.
			// The only problem is that Unity is no more
			// so in Linux/Gnome for example, app.badgeCount is always equal to zero "0"
			if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
				app.badgeCount = activeDownloadItems();
			}

			if (!window_.isDestroyed() && !activeDownloadItems()) {
				window_.setProgressBar(-1);
			}

			if (options.unregisterWhenDone) {
				session.removeListener('will-download', listener);
			}

			if (state === 'cancelled') {
				if (typeof options.onCancel === 'function') {
					options.onCancel(item);
				}
			} else if (state === 'interrupted') {
				const message = pupa(errorMessage, {
					filename: item.getFilename()
				});
				dialog.showErrorBox(errorTitle, message);
				callback(new Error(message));
			} else if (state === 'completed') {
				if (process.platform === 'darwin') {
					app.dock.downloadFinished(filePath);
				}

				if (options.openFolderWhenDone) {
					shell.showItemInFolder(path.join(directory, item.getFilename()));
				}

				callback(null, item);
			}
		});
	};

	session.on('will-download', listener);
}

module.exports = (options = {}) => {
	app.on('session-created', session => {
		registerListener(session, options);
	});
};

module.exports.activeDownloadItems = activeDownloadItems;

module.exports.download = (window_, url, options) =>
	new Promise((resolve, reject) => {
		options = {
			showBadge: true,
			...options,
			unregisterWhenDone: true
		};

		registerListener(window_.webContents.session, options, (error, item) => {
			if (error) {
				reject(error);
			} else {
				resolve(item);
			}
		});

		window_.webContents.downloadURL(url);
	});
