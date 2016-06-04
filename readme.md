# electron-dl [![Build Status](https://travis-ci.org/sindresorhus/electron-dl.svg?branch=master)](https://travis-ci.org/sindresorhus/electron-dl)

> Simplified file downloads for your [Electron](http://electron.atom.io) app


## Why?

- One function call instead of having to manually implement a lot of [boilerplate](index.js).
- Saves the file to the users Downloads directory instead of prompting.
- Bounces the Downloads directory in the dock when done. *(OS X)*
- Shows download progress. Example on OS X:

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


## Related

- [electron-debug](https://github.com/sindresorhus/electron-debug) - Adds useful debug features to your Electron app
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - Context menu for your Electron app
- [electron-config](https://github.com/sindresorhus/electron-config) - Simple config handling for your Electron app or module


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
