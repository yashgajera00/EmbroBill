const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  setPreviewFilename: (filename) => ipcRenderer.send('set-preview-filename', filename)
});
