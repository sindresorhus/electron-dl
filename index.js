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

// The items already taken by a `download()` call, so that concurrent calls for the same URL each get their own item.
const claimedItems = new WeakSet();

const getFilenameFromMime = (name, mime) => {
	const extensions = extName.mime(mime);

	return extensions.length === 1 ? `${name}.${extensions[0].ext}` : name;
};

function registerListener(session, options, callback = () => {}, {ownerWindow, url} = {}) {
	const downloadItems = new Set();
	let receivedBytes = 0;
	let completedBytes = 0;
	let totalBytes = 0;
	const activeDownloadItems = () => downloadItems.size;
	// The total size is 0 when it is not known, for example for a response without `Content-Length`.
	const progressDownloadItems = () => totalBytes === 0 ? 0 : receivedBytes / totalBytes;

	options = {
		showBadge: true,
		showProgressBar: true,
		...options,
	};

	const listener = (event, item, webContents) => {
		// Every `will-download` listener is notified of every download on the session, so `download()` ignores the items of other calls and only ever takes a single item.
		if (url !== undefined) {
			if (item.getURLChain().at(0) !== url || claimedItems.has(item)) {
				return;
			}

			claimedItems.add(item);
			session.removeListener('will-download', listener);
		}

		if (options.directory && !path.isAbsolute(options.directory)) {
			throw new Error('The `directory` option must be an absolute path');
		}

		downloadItems.add(item);
		totalBytes += item.getTotalBytes();

		// `webContents` is null for `session.downloadURL()`, and there is no window for a detached `WebContentsView`.
		const window_ = ownerWindow ?? (webContents ? BrowserWindow.fromWebContents(webContents) : undefined);

		const directory = options.directory ?? app.getPath('downloads');

		let name;
		if (options.filename) {
			name = options.filename;
		} else {
			const filename = item.getFilename();
			name = path.extname(filename) ? filename : getFilenameFromMime(filename, item.getMimeType());
		}

		const filePath = options.overwrite ? path.join(directory, name) : unusedFilenameSync(path.join(directory, name));

		const errorMessage = options.errorMessage ?? 'The download of {filename} was interrupted';

		if (options.saveAs) {
			item.setSaveDialogOptions({defaultPath: filePath, ...options.dialogOptions});
		} else {
			item.setSavePath(filePath);
		}

		item.on('updated', (_event, state) => {
			receivedBytes = completedBytes;
			for (const activeItem of downloadItems) {
				receivedBytes += activeItem.getReceivedBytes();
			}

			if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
				app.badgeCount = activeDownloadItems();
			}

			if (window_ && !window_.isDestroyed() && options.showProgressBar) {
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

			// Chromium stops retrying an interrupted download without ending it, so resume it when the server supports it.
			if (state === 'interrupted' && item.canResume()) {
				item.resume();
			}
		});

		item.on('done', (_event, state) => {
			completedBytes += item.getTotalBytes();
			downloadItems.delete(item);

			if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
				app.badgeCount = activeDownloadItems();
			}

			if (!activeDownloadItems()) {
				if (window_ && !window_.isDestroyed()) {
					window_.setProgressBar(-1);
				}

				receivedBytes = 0;
				completedBytes = 0;
				totalBytes = 0;
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
		registerListener(session, options, error => {
			if (!error || error instanceof CancelError) {
				return;
			}

			const errorTitle = options.errorTitle ?? 'Download Error';
			dialog.showErrorBox(errorTitle, error.message);
		});
	});
}

export async function download(window_, url, options) {
	return new Promise((resolve, reject) => {
		const {session} = window_.webContents;

		// Chromium normalizes the URL, so it must be normalized here too for the item to be recognized as this call's download.
		const normalizedUrl = new URL(url).href;

		// Start the download from the session instead of the `webContents` so it is not subject to the page's origin checks.
		registerListener(session, options, (error, item) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(item);
		}, {
			ownerWindow: BrowserWindow.fromWebContents(window_.webContents),
			url: normalizedUrl,
		});

		session.downloadURL(normalizedUrl);
	});
}
