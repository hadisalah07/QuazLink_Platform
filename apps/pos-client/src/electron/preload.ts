import { contextBridge, ipcRenderer } from 'electron';

// Expose safe Electron APIs to window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
  exitFullscreen: () => ipcRenderer.send('window-exit-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  onFullscreenChanged: (callback: (isFull: boolean) => void) => {
    ipcRenderer.on('fullscreen-changed', (_e, isFull) => callback(isFull));
  },
  setZoomFactor: (factor: number) => ipcRenderer.send('window-set-zoom', factor),
  getZoomFactor: () => ipcRenderer.invoke('window-get-zoom'),
  onZoomChanged: (callback: (factor: number) => void) => {
    ipcRenderer.on('zoom-changed', (_e, factor) => callback(factor));
  },
});
