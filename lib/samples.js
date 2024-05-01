import path from 'node:path';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import pify from 'pify';
import {copyFile} from 'copy-file';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixtureDirectory = path.join(__dirname, '../mock/fixtures');

export const setup = async numberFiles => {
	const promises = [];
	const files = [];

	while (files.length < numberFiles) {
		const filename = `${randomUUID()}.zip`;
		promises.push(copyFile(path.join(fixtureDirectory, 'electron-master.zip'), path.join(fixtureDirectory, filename)));
		files.push(filename);
	}

	await Promise.all(promises);

	return files;
};

export const teardown = async () => {
	const files = await pify(fs.readdir)(fixtureDirectory);
	const promises = [];

	for (const file of files) {
		console.log(path.join(fixtureDirectory, file));
		if (file !== 'electron-master.zip') {
			promises.push(pify(fs.unlink)(path.join(fixtureDirectory, file)));
		}
	}

	return Promise.all(promises);
};

