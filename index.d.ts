import {BrowserView, BrowserWindow, DownloadItem} from 'electron';

declare namespace electronDl {
	interface Progress {
		percent: number;
		transferredBytes: number;
		totalBytes: number;
	}
	
	interface File {
		filename: string,
		path: string,
		fileSize: number,
		mimeType: string,
		url: string
	}

	interface Options {
		/**
		Show a `Save As…` dialog instead of downloading immediately.

		Note: Only use this option when strictly necessary. Downloading directly without a prompt is a much better user experience.

		@default false
		*/
		readonly saveAs?: boolean;

		/**
		Directory to save the file in.

		Default: [User's downloads directory](https://electronjs.org/docs/api/app/#appgetpathname)
		*/
		readonly directory?: string;

		/**
		Name of the saved file.
		This option only makes sense for `electronDl.download()`.

		Default: [`downloadItem.getFilename()`](https://electronjs.org/docs/api/download-item/#downloaditemgetfilename)
		*/
		readonly filename?: string;

		/**
		Title of the error dialog. Can be customized for localization.

		Note: Error dialog will not be shown in `electronDl.download()`. Please handle error manually.

		@default 'Download Error'
		*/
		readonly errorTitle?: string;

		/**
		Message of the error dialog. `{filename}` is replaced with the name of the actual file. Can be customized for localization.

		Note: Error dialog will not be shown in `electronDl.download()`. Please handle error manually.

		@default 'The download of {filename} was interrupted'
		*/
		readonly errorMessage?: string;

		/**
		Optional callback that receives the [download item](https://electronjs.org/docs/api/download-item).
		You can use this for advanced handling such as canceling the item like `item.cancel()`.
		*/
		readonly onStarted?: (item: DownloadItem) => void;

		/**
		Optional callback that receives an object containing information about the progress of the current download item.
		*/
		readonly onProgress?: (progress: Progress) => void;
		
		/**
		Optional callback that receives an object containing information about the combined progress of all download items done within any registered window.
		
		Each time a new download is started, the next callback will include it. The progress percentage could therefore become smaller again.
		This callback provides the same data that is used for the progress bar on the app icon.
		*/
		readonly onTotalProgress?: (progress: Progress) => void;

		/**
		Optional callback that receives the [download item](https://electronjs.org/docs/api/download-item) for which the download has been cancelled.
		*/
		readonly onCancel?: (item: DownloadItem) => void;
		
		/**
		Optional callback that receives an object with information about an item that has been completed. It is called for each completed item.
		*/
		readonly onCompleted?: (file: File) => void;

		/**
		Reveal the downloaded file in the system file manager, and if possible, select the file.

		@default false
		*/
		readonly openFolderWhenDone?: boolean;

		/**
		Shows the file count badge on macOS/Linux dock icons when download is in progress.

		@default true
		*/
		readonly showBadge?: boolean;
	}
}

declare const electronDl: {
	/**
	Register the helper for all windows.

	@example
	```
	import {app, BrowserWindow} from 'electron';
	import electronDl = require('electron-dl');

	electronDl();

	let win;
	(async () => {
		await app.whenReady();
		win = new BrowserWindow();
	})();
	```
	*/
	(options?: electronDl.Options): void;

	/**
	This can be useful if you need download functionality in a reusable module.

	@param window - Window to register the behavior on.
	@param url - URL to download.
	@returns A promise for the downloaded file.

	@example
	```
	import {BrowserWindow, ipcMain} from 'electron';
	import electronDl = require('electron-dl');

	ipcMain.on('download-button', async (event, {url}) => {
		const win = BrowserWindow.getFocusedWindow();
		console.log(await electronDl.download(win, url));
	});
	```
	*/
	download(
		window: BrowserWindow | BrowserView,
		url: string,
		options?: electronDl.Options
	): Promise<DownloadItem>;
};

export = electronDl;
