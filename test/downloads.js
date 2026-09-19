import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import electron from 'electron';
import test from 'ava';

// Each case runs in its own Electron process. The fixture exits with a non-zero code when an assertion fails.
const run = promisify(execFile);
const fixture = fileURLToPath(new URL('fixtures/downloads.js', import.meta.url));

for (const source of ['session', 'view', 'window']) {
	test(`download from a ${source}`, async t => {
		// Electron-based hosts (for example, VS Code) set `ELECTRON_RUN_AS_NODE`, which would make Electron run the fixture as plain Node.js.
		const env = {...process.env};
		delete env.ELECTRON_RUN_AS_NODE;

		// The `signal` option is used instead of `timeout`, because Electron exits with code 0 when it is killed, which would make a hanging fixture look like a pass.
		const {stderr} = await run(electron, [fixture, source], {env, signal: AbortSignal.timeout(30_000)});

		// A native `CHECK` failure only reaches stderr and still exits with code 0, so it has to be detected here. Resuming a download from inside its own event handler trips it.
		t.false(stderr.includes('Check failed'), `Electron logged a native CHECK failure:\n${stderr}`);
	});
}
