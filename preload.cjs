const { contextBridge } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform
});
