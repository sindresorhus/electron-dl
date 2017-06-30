'use strict';
import test from 'ava';
import {Application} from 'spectron';

const path = require('path');
const fs = require('fs-extra');

test.beforeEach(async t => {
	t.context.spectron = new Application({
		path: './node_modules/.bin/electron',
		args: ['./run.js', '--files=3']
	});
	await t.context.spectron.start();
});

test.afterEach.always(async t => {
	await t.context.spectron.stop();
});

test.beforeEach(async t => {
	t.context.files = await fs.readdir(path.join(__dirname, '..', 'mock', 'fixtures'))
		.then(files => files.filter(file => file !== 'electron-master.zip'));
});

test.serial('Download a single file', async t => {
	await t.context.spectron.client.waitUntilWindowLoaded();
	await t.context.spectron.client.url(`http://localhost:8080/index.html?files=${JSON.stringify(t.context.files)}`);
	await t.context.spectron.client.waitForExist(`[data-unique-filename="${t.context.files[0]}"]`);
	await t.context.spectron.client.click(`[data-unique-filename="${t.context.files[0]}"]`);

	t.is(await t.context.spectron.electron.remote.app.getBadgeCount(), 1);
});

test.serial('Download a couple files', async t => {
	await t.context.spectron.client.waitUntilWindowLoaded();
	await t.context.spectron.client.url(`http://localhost:8080/index.html?files=${JSON.stringify(t.context.files)}`);
	await t.context.spectron.client.waitForExist(`[data-unique-filename="${t.context.files[1]}"]`);
	await t.context.spectron.client.waitForExist(`[data-unique-filename="${t.context.files[2]}"]`);
	await t.context.spectron.client.click(`[data-unique-filename="${t.context.files[1]}"]`);
	await t.context.spectron.client.click(`[data-unique-filename="${t.context.files[2]}"]`);

	t.is(await t.context.spectron.electron.remote.app.getBadgeCount(), 2);
});
