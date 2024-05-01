import process from 'node:process';
import path from 'node:path';
import {
	app,
	BrowserWindow,
	shell,
	dialog,
} from 'electron';
import {unusedFilenameSync} from 'unused-filename';
import pupa from 'pupa';
import extName from 'ext-name';

export class CancelError extends Error {}

const getFilenameFromMime = (name, mime) => {
	const extensions = extName.mime(mime);

	if (extensions.length !== 1) {
		return name;
	}

	return `${name}.${extensions[0].ext}`;
};

function registerListener(session, options, callback = () => {}) {
	const downloadItems = new Set();
	let receivedBytes = 0;
	let completedBytes = 0;
	let totalBytes = 0;
	const activeDownloadItems = () => downloadItems.size;
	const progressDownloadItems = () => receivedBytes / totalBytes;

	options = {
		showBadge: true,
		showProgressBar: true,
		...options,
	};

	const listener = (event, item, webContents) => {
		downloadItems.add(item);
		totalBytes += item.getTotalBytes();

		const window_ = BrowserWindow.fromWebContents(webContents);
		if (!window_) {
			throw new Error('Failed to get window from web contents.');
		}

		if (options.directory && !path.isAbsolute(options.directory)) {
			throw new Error('The `directory` option must be an absolute path');
		}

		const directory = options.directory ?? app.getPath('downloads');

		let filePath;
		if (options.filename) {
			filePath = path.join(directory, options.filename);
		} else {
			const filename = item.getFilename();
			const name = path.extname(filename) ? filename : getFilenameFromMime(filename, item.getMimeType());

			filePath = options.overwrite ? path.join(directory, name) : unusedFilenameSync(path.join(directory, name));
		}

		const errorMessage = options.errorMessage ?? 'The download of {filename} was interrupted';

		if (options.saveAs) {
			item.setSaveDialogOptions({defaultPath: filePath, ...options.dialogOptions});
		} else {
			item.setSavePath(filePath);
		}

		item.on('updated', () => {
			receivedBytes = completedBytes;
			for (const item of downloadItems) {
				receivedBytes += item.getReceivedBytes();
			}

			if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
				app.badgeCount = activeDownloadItems();
			}

			if (!window_.isDestroyed() && options.showProgressBar) {
				window_.setProgressBar(progressDownloadItems());
			}

			if (typeof options.onProgress === 'function') {
				const itemTransferredBytes = item.getReceivedBytes();
				const itemTotalBytes = item.getTotalBytes();

				options.onProgress({
					percent: itemTotalBytes ? itemTransferredBytes / itemTotalBytes : 0,
					transferredBytes: itemTransferredBytes,
					totalBytes: itemTotalBytes,
				});
			}

			if (typeof options.onTotalProgress === 'function') {
				options.onTotalProgress({
					percent: progressDownloadItems(),
					transferredBytes: receivedBytes,
					totalBytes,
				});
			}
		});

		item.on('done', (event, state) => {
			completedBytes += item.getTotalBytes();
			downloadItems.delete(item);

			if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
				app.badgeCount = activeDownloadItems();
			}

			if (!window_.isDestroyed() && !activeDownloadItems()) {
				window_.setProgressBar(-1);
				receivedBytes = 0;
				completedBytes = 0;
				totalBytes = 0;
			}

			if (options.unregisterWhenDone) {
				session.removeListener('will-download', listener);
			}

			// eslint-disable-next-line unicorn/prefer-switch
			if (state === 'cancelled') {
				if (typeof options.onCancel === 'function') {
					options.onCancel(item);
				}

				callback(new CancelError());
			} else if (state === 'interrupted') {
				const message = pupa(errorMessage, {filename: path.basename(filePath)});
				callback(new Error(message));
			} else if (state === 'completed') {
				const savePath = item.getSavePath();

				if (process.platform === 'darwin') {
					app.dock.downloadFinished(savePath);
				}

				if (options.openFolderWhenDone) {
					shell.showItemInFolder(savePath);
				}

				if (typeof options.onCompleted === 'function') {
					options.onCompleted({
						fileName: item.getFilename(), // Just for backwards compatibility. TODO: Remove in the next major version.
						filename: item.getFilename(),
						path: savePath,
						fileSize: item.getReceivedBytes(),
						mimeType: item.getMimeType(),
						url: item.getURL(),
					});
				}

				callback(null, item);
			}
		});

		if (typeof options.onStarted === 'function') {
			options.onStarted(item);
		}
	};

	session.on('will-download', listener);
}

export default function electronDl(options = {}) {
	app.on('session-created', session => {
		registerListener(session, options, (error, _) => {
			if (error && !(error instanceof CancelError)) {
				const errorTitle = options.errorTitle ?? 'Download Error';
				dialog.showErrorBox(errorTitle, error.message);
			}
		});
	});
}

export async function download(window_, url, options) {
	return new Promise((resolve, reject) => {
		options = {
			...options,
			unregisterWhenDone: true,
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
}
