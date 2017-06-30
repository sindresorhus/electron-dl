'use strict';
const path = require('path');
const fs = require('fs-extra');
const uuid = require('uuid/v4');

const setup = numFiles => {
	const promises = [];
	const files = [];
	while (files.length < numFiles) {
		const filename = `${uuid()}.zip`;
		promises.push(fs.copy(path.join(__dirname, '..', 'mock', 'fixtures', 'electron-master.zip'), path.join(__dirname, '..', 'mock', 'fixtures', filename)));
		files.push(filename);
	}
	return Promise.all(promises)
		.then(() => files);
};

const teardown = () => {
	return fs.readdir(path.join(__dirname, '..', 'mock', 'fixtures'))
		.then(files => {
			const promises = [];
			files.forEach(file => {
				if (file !== 'electron-master.zip') {
					promises.push(fs.unlink(path.join(__dirname, '..', 'mock', 'fixtures', file)));
				}
			});
			return Promise.all(promises);
		});
};

module.exports = {
	setup,
	teardown
};
