import { BrowserWindow, DownloadItem } from 'electron'

export type ElectronDownloadOptions = {
  saveAs?: boolean;
  directory?: string;
  filename?: string;
  errorTitle?: string;
  errorMessage?: string;
  onStarted?: Function;
  onProgress?: Function;
  onCancel?: Function;
  openFolderWhenDone?: boolean;
  showBadge?: boolean;
}

export interface ElectronDownload {
  (options?: ElectronDownloadOptions): void;
  download: (win: BrowserWindow, url: string, options?: ElectronDownloadOptions) => Promise<DownloadItem>
}

declare const electronDl: ElectronDownload

export default electronDl
