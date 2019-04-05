/// <reference lib="dom"/>
/// <reference types="node"/>
import {expectType} from 'tsd';
import {BrowserWindow, DownloadItem} from 'electron';
import electronDl = require('.');
import {download} from '.';

expectType<void>(electronDl());
expectType<Promise<DownloadItem>>(
	download(new BrowserWindow(), 'test', {errorTitle: 'Nope'})
);
