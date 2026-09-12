const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noveraDesktop', {
  isDesktop: true,
  platform: process.platform,

  // Native Windows File Dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:open-files'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),

  // Windows Explorer Integration
  showInExplorer: (filePath) => ipcRenderer.invoke('shell:show-in-folder', filePath),

  // Storage Management
  saveBookToStorage: (fileName, arrayBuffer) => ipcRenderer.invoke('fs:save-book', { fileName, buffer: arrayBuffer }),
  deleteBookFromStorage: (filePath) => ipcRenderer.invoke('fs:delete-book', filePath),
  getStoragePath: () => ipcRenderer.invoke('fs:get-storage-path'),
  readEpubFile: (filePath) => ipcRenderer.invoke('fs:read-epub', filePath),

  // Native Electron fullscreen state
  toggleNativeFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isNativeFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Metadata
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Listen for file opened by Windows Explorer / CLI / Drag to app
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file-from-os', (_event, filePath) => callback(filePath));
  },
  onNativeFullscreenChanged: (callback) => {
    ipcRenderer.on('native-fullscreen-changed', (_event, isFullscreen) => callback(Boolean(isFullscreen)));
  }
});
