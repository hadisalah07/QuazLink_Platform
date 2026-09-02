const { contextBridge, ipcRenderer } = require('electron');

// Secure bridge between the (isolated, node-integration-off) renderer and the main process.
// The renderer can only touch exactly what we expose here as `window.quazlink` — it can no
// longer `require('electron')` or reach Node/`shell` directly. Keep this surface minimal.
contextBridge.exposeInMainWorld('quazlink', {
  // ── fire-and-forget commands ──────────────────────────────────────────────
  closeWindow: () => ipcRenderer.send('close-window'),
  toggleKeepAwake: (enabled: boolean) => ipcRenderer.send('toggle-keep-awake', enabled),
  pairDevice: (code: string) => ipcRenderer.send('pair-device', code),
  unpairDevice: () => ipcRenderer.send('unpair-device'),
  getState: () => ipcRenderer.send('get-state'),
  // `shell` is not reachable from a bridged renderer, so route external opens through main,
  // where the URL is validated against an https + known-host allowlist before opening.
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // ── main → renderer events ────────────────────────────────────────────────
  // Delivers { status, info, config }. We wrap the listener so the raw IpcRendererEvent
  // (which can carry sender internals) never leaks into page scripts.
  onStatusUpdated: (cb: (data: any) => void) =>
    ipcRenderer.on('status-updated', (_event: any, data: any) => cb(data)),
});
