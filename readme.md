# electron-dl [![Build Status](https://travis-ci.org/sindresorhus/electron-dl.svg?branch=master)](https://travis-ci.org/sindresorhus/electron-dl)

> Simplified file downloads for your [Electron](http://electron.atom.io) app


## Why?

- One function call instead of having to manually implement a lot of [boilerplate](index.js).
- Saves the file to the users downloads directory instead of prompting.
- Shows download progress. Example on OS X:

<img src="screenshot.png" width="82">


## Install

```
$ npm install --save electron-dl
```


## Usage

```js
const {app, BrowserWindow} = require('electron');

require('electron-dl')();

let win;

app.on('ready', () => {
	win = new BrowserWindow();
});
```


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
