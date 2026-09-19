import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
	app,
	BrowserWindow,
	dialog,
	WebContentsView,
	session,
} from 'electron';
import electronDl, {download, CancelError} from '../../index.js';

// Which download source to test: `session` (`session.downloadURL()`, no `webContents`), `view` (detached `WebContentsView`, no window), or `window` (`BrowserWindow`).
const source = process.argv[2];

// Report the original uncaught exception instead of opening an error dialog.
process.on('uncaughtException', error => {
	console.error(error);
	app.exit(1);
});

// Keep the app alive after the hidden test window is destroyed so the assertions and cleanup can finish.
app.on('window-all-closed', () => {});

// Fail instead of blocking on the error dialog `electronDl()` shows for interrupted downloads.
dialog.showErrorBox = (title, message) => {
	throw new Error(`${title}: ${message}`);
};

async function testSession(url, directory) {
	let completed;
	let progress;
	electronDl({
		directory,
		showBadge: false,
		onTotalProgress(value) {
			progress = value;
		},
		onCompleted: file => completed(file),
	});

	// Use a separate session so the `session-created` event fires after `electronDl()` has registered its listener.
	const downloadSession = session.fromPartition('downloads');
	downloadSession.on('will-download', (event, item, webContents) => {
		assert.equal(webContents, null);
	});

	const checkDownload = async size => {
		progress = undefined;
		const file = await new Promise(resolve => {
			completed = resolve;
			downloadSession.downloadURL(url(size));
		});
		assert.deepEqual(await readFile(file.path), Buffer.alloc(size, 'x'));
		assert.deepEqual(progress, {percent: 1, transferredBytes: size, totalBytes: size});
	};

	// Download twice with the same listener to check that byte counters reset between downloads.
	await checkDownload(4096);
	await checkDownload(8192);

	// A download of unknown size must not report `NaN` (https://github.com/sindresorhus/electron-dl/issues/100).
	progress = undefined;
	const chunked = await new Promise(resolve => {
		completed = resolve;
		downloadSession.downloadURL(url(4096, true));
	});
	assert.deepEqual(await readFile(chunked.path), Buffer.alloc(4096, 'x'));
	assert.deepEqual(progress, {percent: 0, transferredBytes: 4096, totalBytes: 0});
}

async function testOwner(url, directory) {
	const downloadSession = session.fromPartition('downloads');
	const owner = source === 'view'
		? new WebContentsView({webPreferences: {session: downloadSession}})
		: new BrowserWindow({show: false, webPreferences: {session: downloadSession}});
	const window_ = BrowserWindow.fromWebContents(owner.webContents);
	assert.equal(window_, source === 'view' ? null : owner);

	// `download()` starts the download from the session, so `will-download` must not have a `webContents`.
	downloadSession.on('will-download', (event, item, webContents) => {
		assert.equal(webContents, null);
	});

	const listeners = downloadSession.listenerCount('will-download');

	// Record the progress bar values instead of showing them in the dock/taskbar.
	const progress = [];
	if (window_) {
		window_.setProgressBar = value => {
			progress.push(value);
		};
	}

	try {
		const item = await download(owner, url(4096), {directory, showBadge: false});
		assert.deepEqual(await readFile(item.getSavePath()), Buffer.alloc(4096, 'x'));

		// `download()` registers a listener with `unregisterWhenDone`, so the count must be back to what it was.
		assert.equal(downloadSession.listenerCount('will-download'), listeners);
		if (window_) {
			assert.ok(progress.some(value => value >= 0));
			assert.equal(progress.at(-1), -1);
		}

		await assert.rejects(download(owner, url(8192), {
			directory,
			showBadge: false,
			onStarted: downloadItem => downloadItem.cancel(),
		}), CancelError);
		assert.equal(downloadSession.listenerCount('will-download'), listeners);

		// `filename` must not bypass `overwrite` (https://github.com/sindresorhus/electron-dl/issues/144).
		const explicitFilename = {directory, filename: 'report.bin', showBadge: false};
		const first = await download(owner, url(1024), explicitFilename);
		const second = await download(owner, url(1024), explicitFilename);
		assert.equal(path.basename(first.getSavePath()), 'report.bin');
		assert.equal(path.basename(second.getSavePath()), 'report (1).bin');

		await download(owner, url(4096), {...explicitFilename, overwrite: true});
		assert.deepEqual(await readFile(path.join(directory, 'report.bin')), Buffer.alloc(4096, 'x'));
		assert.equal(downloadSession.listenerCount('will-download'), listeners);
	} finally {
		if (window_) {
			window_.destroy();
		} else {
			owner.webContents.close();
		}
	}
}

async function run() {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'electron-dl-'));

	// Serves a file of the size given in the URL path, for example `/4096`. A `chunked` path omits `Content-Length`, which leaves the total size unknown.
	const server = http.createServer((request, response) => {
		const [size, chunked] = request.url.slice(1).split('?', 2);
		const data = Buffer.alloc(Number(size), 'x');
		response.writeHead(200, {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': 'attachment; filename="fixture.bin"',
			...!chunked && {'Content-Length': data.length},
		});
		response.end(data);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const url = (size, chunked) => `http://127.0.0.1:${server.address().port}/${size}${chunked ? '?chunked' : ''}`;

	try {
		await (source === 'session' ? testSession(url, directory) : testOwner(url, directory));
	} finally {
		server.closeAllConnections();
		await new Promise(resolve => {
			server.close(resolve);
		});
		await rm(directory, {recursive: true, force: true});
	}
}

// Electron does not emit `ready` until the main module has finished evaluating, so a top-level `await app.whenReady()` would deadlock.
// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
	try {
		await app.whenReady();
		await run();
		app.exit(0);
	} catch (error) {
		console.error(error);
		app.exit(1);
	}
})();
