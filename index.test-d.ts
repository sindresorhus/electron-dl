import {expectType} from 'tsd-check';
import {BrowserWindow} from 'electron';
import electronDl, {download} from '.';

expectType<void>(electronDl());
expectType<Electron.DownloadItem>(await download(new BrowserWindow(), 'test', {errorTitle: 'Nope'}));
