import {expectType} from 'tsd-check';
import {BrowserWindow, DownloadItem} from 'electron';
import electronDl, {download} from '.';

expectType<void>(electronDl());
expectType<DownloadItem>(await download(new BrowserWindow(), 'test', {errorTitle: 'Nope'}));
