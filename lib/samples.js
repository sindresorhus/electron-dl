'use strict';
const path = require('path');
const fs = require('fs');
const pify = require('pify');
const cpFile = require('cp-file');
const uuid = require('uuid/v4');

const fixtureDir = path.join(__dirname, '../mock/fixtures');

const setup = async numFiles => {
	const promises = [];
	const files = [];

	while (files.length < numFiles) {
		const filename = `${uuid()}.zip`;
		promises.push(cpFile(path.join(fixtureDir, 'electron-master.zip'), path.join(fixtureDir, filename)));
		files.push(filename);
	}

	await Promise.all(promises);

	return files;
};

const teardown = async () => {
	const files = await pify(fs.readdir)(fixtureDir);
	const promises = [];

	for (const file of files) {
		console.log(path.join(fixtureDir, file));
		if (file !== 'electron-master.zip') {
			promises.push(pify(fs.unlink)(path.join(fixtureDir, file)));
		}
	}

	return Promise.all(promises);
};

module.exports = {
	setup,
	teardown
};
