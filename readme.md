# electron-dl [![Build Status](https://travis-ci.org/sindresorhus/electron-dl.svg?branch=master)](https://travis-ci.org/sindresorhus/electron-dl)

> Simplified file downloads for your [Electron](http://electron.atom.io) app


## Why?

- One function call instead of having to manually implement a lot of [boilerplate](index.js).
- Saves the file to the users Downloads directory instead of prompting.
- Bounces the Downloads directory in the dock when done. *(macOS)*
- Shows download progress. Example on macOS:

<img src="screenshot.png" width="82">


## Install

```
$ npm install --save electron-dl
```


## Usage

### Register it for all windows

This is probably what you want for your app.

```js
const {app, BrowserWindow} = require('electron');

require('electron-dl')();

let win;

app.on('ready', () => {
	win = new BrowserWindow();
});
```

### Use it manually

This can be useful if you need download functionality in a reusable module.

```js
const {app, BrowserWindow, ipcMain} = require('electron');
const {download} = require('electron-dl');

ipcMain.on('download-btn', (e, args) => {
	download(BrowserWindow.getFocusedWindow(), args.url);
});
```

## API

### download(window, url, [options])

### window

Type: `BrowserWindow`

Window to register the behaviour on

### url

Type: `String`

The URL to download

### options

#### saveAs

Type: `Boolean`

Default: `false`

Show a "Save As…" dialog instead of downloading immediately.

Useful if you're concerned about overriding existing files. See [issue #3](https://github.com/sindresorhus/electron-dl/issues/3)

## Related

- [electron-debug](https://github.com/sindresorhus/electron-debug) - Adds useful debug features to your Electron app
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - Context menu for your Electron app
- [electron-config](https://github.com/sindresorhus/electron-config) - Simple config handling for your Electron app or module


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
