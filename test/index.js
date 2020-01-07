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
	await client.waitForExist(`[data-unique-filename="${t.context.files[0]}"]`);
	await client.click(`[data-unique-filename="${t.context.files[0]}"]`);

	t.is(await t.context.spectron.electron.remote.app.badgeCount(), 1);
});

test('download a couple files', async t => {
	const {client} = t.context.spectron;
	await client.waitUntilWindowLoaded();
	await client.url(`http://localhost:8080/index.html?files=${JSON.stringify(t.context.files)}`);
	await client.waitForExist(`[data-unique-filename="${t.context.files[1]}"]`);
	await client.waitForExist(`[data-unique-filename="${t.context.files[2]}"]`);
	await client.click(`[data-unique-filename="${t.context.files[1]}"]`);
	await client.click(`[data-unique-filename="${t.context.files[2]}"]`);

	// The first download appears to finish before the second is added sometimes
	const badgeCount = await t.context.spectron.electron.remote.app.badgeCount();
	t.true(badgeCount === 1 || badgeCount === 2);
});
