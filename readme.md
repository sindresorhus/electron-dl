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
	download(BrowserWindow.getFocusedWindow(), args.url)
		.then(dl => console.log(dl.getSavePath()))
		.catch(console.error);
});
```

## API

### electronDl([options])

### electronDl.download(window, url, [options]): Promise<[DownloadItem](https://github.com/electron/electron/blob/master/docs/api/download-item.md)>

### window

Type: `BrowserWindow`

Window to register the behavior on.

### url

Type: `string`

URL to download.

### options

#### saveAs

Type: `boolean`<br>
Default: `false`

Show a `Save As…` dialog instead of downloading immediately.

Note: Only use this option when strictly necessary. Downloading directly without a prompt is a much better user experience.

#### directory

Type: `string`<br>
Default: [User's downloads directory](http://electron.atom.io/docs/api/app/#appgetpathname)

Directory to save the file in.

#### errorTitle

Type: `string`<br>
Default: `Download Error`

Title of the error dialog. Can be customized for localization.

#### errorMessage

Type: `string`<br>
Default: `The download of {filename} was interrupted`

Message of the error dialog. `{filename}` is replaced with the name of the actual file. Can be customized for localization.

#### onProgress

Type: `Function`

Optional callback that receives a number between `0` and `1` representing the progress of the current download.


## Related

- [electron-debug](https://github.com/sindresorhus/electron-debug) - Adds useful debug features to your Electron app
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) - Context menu for your Electron app
- [electron-config](https://github.com/sindresorhus/electron-config) - Simple config handling for your Electron app or module


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
