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
import {unsafeFilenameFixtures} from 'is-safe-filename';
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
	const webContentsValues = [];
	let isInterrupted = false;
	downloadSession.on('will-download', (event, item, webContents) => {
		webContentsValues.push(webContents);
		item.on('updated', (_event, state) => {
			isInterrupted ||= state === 'interrupted';
		});
	});

	const checkDownload = async size => {
		progress = undefined;
		webContentsValues.length = 0;
		const file = await new Promise(resolve => {
			completed = resolve;
			downloadSession.downloadURL(url(size));
		});
		assert.deepEqual(await readFile(file.path), Buffer.alloc(size, 'x'));
		assert.deepEqual(progress, {percent: 1, transferredBytes: size, totalBytes: size});

		// `session.downloadURL()` has no `webContents`, so there is no window to show a progress bar on.
		assert.deepEqual(webContentsValues, [null]);
	};

	// Download twice with the same listener to check that byte counters reset between downloads.
	await checkDownload(4096);
	await checkDownload(8192);

	// A download of unknown size must not report `NaN` (https://github.com/sindresorhus/electron-dl/issues/100).
	progress = undefined;
	const chunked = await new Promise(resolve => {
		completed = resolve;
		downloadSession.downloadURL(url(4096, '?chunked'));
	});
	assert.deepEqual(await readFile(chunked.path), Buffer.alloc(4096, 'x'));
	assert.deepEqual(progress, {percent: 0, transferredBytes: 4096, totalBytes: 0});

	// An interrupted download is resumed when the server supports it (https://github.com/sindresorhus/electron-dl/issues/174).
	isInterrupted = false;
	const size = 64 * 1024;
	const resumed = await new Promise(resolve => {
		completed = resolve;
		downloadSession.downloadURL(url(size, '?dropping'));
	});
	assert.deepEqual(await readFile(resumed.path), Buffer.alloc(size, 'x'));
	assert.ok(isInterrupted, 'the download must be interrupted before it can be resumed');

	// A download started by a `webContents` reports that `webContents`, and the window is found from it to show the progress bar.
	const window_ = new BrowserWindow({show: false, webPreferences: {session: downloadSession}});
	const progressBar = [];
	window_.setProgressBar = value => {
		progressBar.push(value);
	};

	try {
		webContentsValues.length = 0;
		const file = await new Promise(resolve => {
			completed = resolve;
			window_.webContents.downloadURL(url(4096));
		});
		assert.deepEqual(await readFile(file.path), Buffer.alloc(4096, 'x'));
		assert.deepEqual(webContentsValues, [window_.webContents]);
		assert.ok(progressBar.some(value => value >= 0));
		assert.equal(progressBar.at(-1), -1);
	} finally {
		window_.destroy();
	}
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

		// `download()` unregisters its listener as soon as it takes its item, so the count must be back to what it was.
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

async function testConcurrent(url, directory) {
	const downloadSession = session.fromPartition('downloads');
	const owner = new BrowserWindow({show: false, webPreferences: {session: downloadSession}});
	const listeners = downloadSession.listenerCount('will-download');

	try {
		// Concurrent calls must not apply each other's options or resolve with each other's item (https://github.com/sindresorhus/electron-dl/issues/44).
		const [first, second] = await Promise.all([
			download(owner, url(4096), {directory, filename: 'first.bin', showBadge: false}),
			download(owner, url(8192), {directory, filename: 'second.bin', showBadge: false}),
		]);

		assert.equal(first.getURL(), url(4096));
		assert.equal(second.getURL(), url(8192));
		assert.equal(path.basename(first.getSavePath()), 'first.bin');
		assert.equal(path.basename(second.getSavePath()), 'second.bin');
		assert.deepEqual(await readFile(first.getSavePath()), Buffer.alloc(4096, 'x'));
		assert.deepEqual(await readFile(second.getSavePath()), Buffer.alloc(8192, 'x'));
		assert.equal(downloadSession.listenerCount('will-download'), listeners);

		// A redirect is still the requested download, so `getURL()` cannot be used for the matching.
		const redirected = await download(owner, url(4096, '?redirect'), {directory, filename: 'redirected.bin', showBadge: false});
		assert.deepEqual(await readFile(redirected.getSavePath()), Buffer.alloc(4096, 'x'));

		// Chromium normalizes the URL, so a URL that is not already in its normalized form must still match.
		const unnormalized = await download(owner, `HTTP://127.0.0.1:${new URL(url(4096)).port}/a/../4096`, {directory, filename: 'unnormalized.bin', showBadge: false});
		assert.deepEqual(await readFile(unnormalized.getSavePath()), Buffer.alloc(4096, 'x'));

		// A relative `directory` must reject instead of throwing out of the `will-download` listener, which would leave the promise unsettled.
		await assert.rejects(download(owner, url(4096), {directory: 'relative', showBadge: false}), {message: 'The `directory` option must be an absolute path'});
		assert.equal(downloadSession.listenerCount('will-download'), listeners);

		// A `filename` that could escape `directory` must be rejected, since it would otherwise write outside the directory the app chose.
		await Promise.all(unsafeFilenameFixtures.map(filename => assert.rejects(
			download(owner, url(4096), {directory, filename, showBadge: false}),
			{message: /Unsafe filename/v},
		)));

		assert.equal(downloadSession.listenerCount('will-download'), listeners);

		// Concurrent calls for the same URL must still each get their own item.
		const sameUrl = await Promise.all([
			download(owner, url(4096), {directory, filename: 'same-first.bin', showBadge: false}),
			download(owner, url(4096), {directory, filename: 'same-second.bin', showBadge: false}),
		]);
		assert.notEqual(sameUrl[0], sameUrl[1]);
		assert.deepEqual(
			sameUrl.map(item => path.basename(item.getSavePath())).toSorted((a, b) => a.localeCompare(b)),
			['same-first.bin', 'same-second.bin'],
		);
		assert.equal(downloadSession.listenerCount('will-download'), listeners);
	} finally {
		owner.destroy();
	}
}

async function run() {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'electron-dl-'));

	// Serves a file of the size given in the URL path, for example `/4096`. The `chunked` parameter omits `Content-Length`, which leaves the total size unknown, `redirect` serves the file through a redirect, and `dropping` drops the connection part-way through.
	let droppingRequests = 0;

	const server = http.createServer((request, response) => {
		const [size, search] = request.url.slice(1).split('?', 2);
		const parameters = new URLSearchParams(search);

		if (parameters.has('redirect')) {
			response.writeHead(302, {Location: `/${size}`});
			response.end();
			return;
		}

		const data = Buffer.alloc(Number(size), 'x');

		// Drops every connection until Chromium has given up retrying, so the download can only finish after it is resumed.
		if (parameters.has('dropping')) {
			const {range} = request.headers;
			const start = range ? Number(/(?<start>\d+)/v.exec(range).groups.start) : 0;
			const remaining = data.subarray(start);

			response.writeHead(206, {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': 'attachment; filename="fixture.bin"',
				'Content-Length': remaining.length,
				'Content-Range': `bytes ${start}-${data.length - 1}/${data.length}`,
				'Accept-Ranges': 'bytes',
				ETag: '"fixture"',
				'Last-Modified': 'Wed, 18 Feb 2026 03:27:43 GMT',
			});

			if (droppingRequests++ < 10) {
				response.write(remaining.subarray(0, Math.floor(remaining.length / 2)));
				setTimeout(() => {
					response.destroy();
				}, 20);
			} else {
				response.end(remaining);
			}

			return;
		}

		response.writeHead(200, {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': 'attachment; filename="fixture.bin"',
			...!parameters.has('chunked') && {'Content-Length': data.length},
		});
		response.end(data);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const url = (size, search = '') => `http://127.0.0.1:${server.address().port}/${size}${search}`;

	try {
		if (source === 'session') {
			await testSession(url, directory);
		} else {
			await testOwner(url, directory);
			await testConcurrent(url, directory);
		}
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
