'use strict';
import fs from 'fs';
import path from 'path';
import {serial as test} from 'ava';
import pify from 'pify';
import {Application} from 'spectron';

test.beforeEach(async t => {
	t.context.spectron = new Application({
		path: 'node_modules/.bin/electron',
		args: [
			'run.js',
			'--files=3'
		]
	});
	await t.context.spectron.start();
});

test.beforeEach(async t => {
	const files = await pify(fs.readdir)(path.join(__dirname, '../mock/fixtures'));
	t.context.files = files.filter(file => file !== 'electron-master.zip');
});

test.afterEach.always(async t => {
	await t.context.spectron.stop();
});

test('download a single file', async t => {
	const {client} = t.context.spectron;
	await client.waitUntilWindowLoaded();
	await client.url(`http://localhost:8080/index.html?files=${JSON.stringify(t.context.files)}`);

	const file0 = await client.$(`[data-unique-filename="${t.context.files[0]}"]`);
	await file0.waitForClickable();
	await file0.click();

	t.is(await t.context.spectron.electron.remote.app.getBadgeCount(), 1);
});

test('download a couple files', async t => {
	const {client} = t.context.spectron;
	await client.waitUntilWindowLoaded();
	await client.url(`http://localhost:8080/index.html?files=${JSON.stringify(t.context.files)}`);

	const file1 = await client.$(`[data-unique-filename="${t.context.files[1]}"]`);
	const file2 = await client.$(`[data-unique-filename="${t.context.files[2]}"]`);
	await file1.waitForClickable();
	await file2.waitForClickable();
	await file1.click();
	await file2.click();

	// The first download appears to finish before the second is added sometimes
	const badgeCount = await t.context.spectron.electron.remote.app.getBadgeCount();
	t.true(badgeCount === 1 || badgeCount === 2);
});
