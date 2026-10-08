import { contextBridge, ipcRenderer } from 'electron';

// Expose safe Electron APIs to window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
  setZoomFactor: (factor: number) => ipcRenderer.send('window-set-zoom', factor),
  getZoomFactor: () => ipcRenderer.invoke('window-get-zoom'),
});
