import {randomUUID} from 'node:crypto';
import {copyFile, readdir, unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixtureDirectory = path.join(__dirname, '../mock/fixtures');

export const setup = async numberFiles => {
	const files = [];

	while (files.length < numberFiles) {
		files.push(`${randomUUID()}.zip`);
	}

	await Promise.all(files.map(filename => copyFile(path.join(fixtureDirectory, 'electron-master.zip'), path.join(fixtureDirectory, filename))));

	return files;
};

export const teardown = async () => {
	const files = await readdir(fixtureDirectory);
	const promises = [];

	for (const file of files) {
		console.log(path.join(fixtureDirectory, file));
		if (file !== 'electron-master.zip') {
			promises.push(unlink(path.join(fixtureDirectory, file)));
		}
	}

	return Promise.all(promises);
};
