'use strict';
const path = require('path');
const electron = require('electron');
const unusedFilename = require('unused-filename');
const pupa = require('pupa');
const extName = require('ext-name');
const _ = require('lodash');

const {app, shell} = electron;

const CONFIG = {
  NO_PROGRESS_THRESHOLD: 20,
  DOWNLOAD_MAX_RETRY: 3
};

function getFilenameFromMime(name, mime) {
  const exts = extName.mime(mime);

  if (exts.length !== 1) {
    return name;
  }

  return `${name}.${exts[0].ext}`;
}

const sessionListenerMap = new Map();
const handlerMap = new Map();
const downloadItems = new Set();
let receivedBytes = 0;
let completedBytes = 0;
let totalBytes = 0;
const activeDownloadItems = () => downloadItems.size;
const progressDownloadItems = function (item) {
  if (item) {
    return item.getReceivedBytes() / item.getTotalBytes();
  }
  return receivedBytes / totalBytes;
};

function registerListener(session) {
  const listener = (e, item, webContents) => {
    const urlChains = item.getURLChain();
    const originUrl = _.first(urlChains);
    const key = decodeURIComponent(originUrl);
    const defaultHanlder = {
      options: {},
      resolve: () => { },
      reject: () => { }
    };

    var handlers = handlerMap.get(key) || defaultHanlder;
    const {options, resolve, reject} = handlers;

    downloadItems.add(item);
    totalBytes += item.getTotalBytes();

    let hostWebContents = webContents;
    if (webContents.getType() === 'webview') {
      ({hostWebContents} = webContents);
    }
    const win = electron.BrowserWindow.fromWebContents(hostWebContents);

    const dir = options.directory || app.getPath('downloads');
    let filePath;
    if (options.filename) {
      filePath = path.join(dir, options.filename);
    } else {
      const filename = item.getFilename();
      const name = path.extname(filename) ? filename : getFilenameFromMime(filename, item.getMimeType());

      filePath = unusedFilename.sync(path.join(dir, name));
    }

    const errorMessage = options.errorMessage || 'The download of {filename} was interrupted';
    const errorTitle = options.errorTitle || 'Download Error';

    if (!options.saveAs) {
      item.setSavePath(filePath);
    }

    item.on('updated', (e, state) => {
      if (handlers.retryCount >= CONFIG.DOWNLOAD_MAX_RETRY) {
        item.removeAllListeners();
        _resetStats(win);
        return reject(new Error(`Failed to start download for ${key}`));
      }

      if (state === 'interrupted' && item.canResume()) {
        // This may a flash network interuption, we can retry a few times
        setTimeout(() => {
          handlers.retryCount++;
          item.resume();
        }, 5000);
        return;
      }

      var updateProgress = progressDownloadItems(item);
      if (updateProgress === handlers.progress) {
        // No download progress, the download maybe passively interupted (network issue)
        // Electron does not raised interupted state for this case at the moment, so we handle ourself
        if (handlers.noProgress === CONFIG.NO_PROGRESS_THRESHOLD) {
          item.removeAllListeners();
          _resetStats(win);
          return reject(new Error(`Failed to download for ${key}`));
        }

        handlers.noProgress++;
      } else {
        handlers.progress = updateProgress;
        handlers.noProgress = 0;
      }
      receivedBytes = [...downloadItems].reduce((receivedBytes, item) => {
        receivedBytes += item.getReceivedBytes();
        return receivedBytes;
      }, completedBytes);

      if (['darwin', 'linux'].includes(process.platform)) {
        app.setBadgeCount(activeDownloadItems());
      }

      if (!win.isDestroyed()) {
        win.setProgressBar(progressDownloadItems());
      }

      if (typeof options.onProgress === 'function') {
        options.onProgress(progressDownloadItems(item));
      }
    });

    item.once('done', (e, state) => {
      completedBytes += item.getTotalBytes();
      item.removeAllListeners();
      downloadItems.delete(item);

      if (['darwin', 'linux'].includes(process.platform)) {
        app.setBadgeCount(activeDownloadItems());
      }

      if (!activeDownloadItems()) {
        _resetStats(win);
      }

      if (state === 'interrupted') {
        const message = pupa(errorMessage, {filename: item.getFilename()});
        electron.dialog.showErrorBox(errorTitle, message);
        reject(new Error(message));
      } else if (state === 'cancelled') {
        _resetStats(win);
        reject(new Error('The download has been cancelled'));
      } else if (state === 'completed') {
        if (process.platform === 'darwin') {
          app.dock.downloadFinished(filePath);
        }

        if (options.openFolderWhenDone) {
          shell.showItemInFolder(filePath);
        }

        resolve(item);
      }
      if (handlerMap.has(key)) {
        handlerMap.delete(key);
      }
    });
  };

  return listener;
}

function unregisterListener (session) {
  if (sessionListenerMap.has(session)) {
    sessionListenerMap.delete(session);
  }
}

function _resetStats (win) {
  if (win && !win.isDestroyed()) {
    win.setProgressBar(-1);
	}

  receivedBytes = 0;
  completedBytes = 0;
  totalBytes = 0;
  downloadItems.clear();
}

module.exports = (options = {}) => {
  app.on('session-created', session => {
    registerListener(session, options);
    app.on('close', () => unregisterListener(session));
  });
};

module.exports.download = (win, url, options) => new Promise((resolve, reject) => {
  options = Object.assign({}, options, {unregisterWhenDone: true});

  const key = decodeURIComponent(url);
  handlerMap.set(key, {options, resolve, reject, progress: 0, retryCount: 0, noProgress: 0});

  var session = win.webContents.session;
  // Only need to register listener for new window/session
  if (!sessionListenerMap.get(session)) {
    sessionListenerMap.set(session, true);
		session.on('will-download', () => registerListener(session));
    win.on('close', () => unregisterListener(session));
  }

  win.webContents.downloadURL(url);
});
