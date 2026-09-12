const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');

let mainWindow = null;
let pendingOpenFile = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Check if an EPUB file path was passed in the arguments
      const filePath = extractEpubArg(argv);
      if (filePath) {
        dispatchOpenFile(filePath);
      }
    }
  });
}

function extractEpubArg(args) {
  for (const arg of args) {
    if (typeof arg === 'string' && arg.toLowerCase().endsWith('.epub')) {
      if (fs.existsSync(arg)) {
        return path.resolve(arg);
      }
    }
  }
  return null;
}

function dispatchOpenFile(filePath) {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingOpenFile = filePath;
    return;
  }
  mainWindow.webContents.send('open-file-from-os', filePath);
}

// Ensure AppData storage directory exists
function getBooksStorageDir() {
  const booksDir = path.join(app.getPath('userData'), 'books');
  if (!fs.existsSync(booksDir)) {
    fs.mkdirSync(booksDir, { recursive: true });
  }
  return booksDir;
}

// Window state storage
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const file = getWindowStatePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {}
  return { width: 1280, height: 850, isMaximized: false };
}

function saveWindowState(win) {
  try {
    if (!win) return;
    const isMaximized = win.isMaximized();
    const bounds = win.getNormalBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    };
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch (e) {}
}

function createWindow() {
  const state = loadWindowState();

  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width || 1280,
    height: state.height || 850,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0C0C12',
    icon: iconPath,
    show: false,
    title: 'Novera — A beautiful home for your books',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true
    }
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Load the application
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // If an EPUB was passed at launch, dispatch it now
    const initialFile = pendingOpenFile || extractEpubArg(process.argv);
    if (initialFile) {
      setTimeout(() => {
        pendingOpenFile = null;
        dispatchOpenFile(initialFile);
      }, 500);
    }
  });

  // Save window dimensions on close
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('native-fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('native-fullscreen-changed', false);
  });

  // External web links open in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Native Windows File Dialog
ipcMain.handle('dialog:open-files', async () => {
  if (!mainWindow) return { canceled: true, files: [] };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select one EPUB book',
    buttonLabel: 'Import to Novera',
    filters: [
      { name: 'EPUB eBooks (*.epub)', extensions: ['epub'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true, files: [] };
  }

  const loadedFiles = [];
  const errors = [];
  for (const filePath of result.filePaths.slice(0, 1)) {
    try {
      const buffer = fs.readFileSync(filePath);
      await validateEpubBuffer(buffer);
      const name = path.basename(filePath);
      loadedFiles.push({
        name,
        path: filePath,
        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        size: buffer.length
      });
    } catch (e) {
      console.error('Error reading file:', filePath, e);
      errors.push({ name: path.basename(filePath), error: e.message });
    }
  }

  return { canceled: false, files: loadedFiles, errors };
});

// Native Windows Folder Dialog (batch import)
ipcMain.handle('dialog:open-folder', async () => {
  if (!mainWindow) return { canceled: true, files: [] };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folder Containing EPUBs',
    buttonLabel: 'Import Folder',
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true, files: [] };
  }

  const dirPath = result.filePaths[0];
  const loadedFiles = [];
  const errors = [];

  async function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.epub')) {
        try {
          const buffer = fs.readFileSync(full);
          await validateEpubBuffer(buffer);
          loadedFiles.push({
            name: entry.name,
            path: full,
            data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
            size: buffer.length
          });
        } catch (e) {
          errors.push({ name: full, error: e.message });
        }
      }
    }
  }

  try {
    await scanDir(dirPath);
  } catch (e) {
    console.error('Folder scan error:', e);
  }

  return { canceled: false, files: loadedFiles, errors };
});

async function validateEpubBuffer(buffer) {
  if (!buffer || buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504b0304) {
    throw new Error('Not a readable ZIP archive');
  }
  const zip = await JSZip.loadAsync(buffer);
  if (zip.file('META-INF/rights.xml')) throw new Error('DRM-protected EPUBs are not supported');
  if (zip.file('META-INF/encryption.xml')) throw new Error('Encrypted EPUB resources are not supported');
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('Missing META-INF/container.xml');
  const containerXml = await container.async('text');
  const rootfile = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  if (!rootfile || !zip.file(rootfile[1])) throw new Error('Missing EPUB package document (OPF)');
  return true;
}

// Reveal in Windows File Explorer
ipcMain.handle('shell:show-in-folder', (_event, targetPath) => {
  if (targetPath && fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
    return true;
  }
  return false;
});

// Save copy of book in AppData storage
ipcMain.handle('fs:save-book', (_event, { fileName, buffer }) => {
  try {
    const storageDir = getBooksStorageDir();
    // Sanitize filename
    const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const destPath = path.join(storageDir, safeName);
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return { success: true, path: destPath };
  } catch (e) {
    console.error('Failed to persist book to disk:', e);
    return { success: false, error: e.message };
  }
});

// Delete book from disk
ipcMain.handle('fs:delete-book', (_event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.error('Error deleting book file:', e);
  }
  return false;
});

ipcMain.handle('fs:get-storage-path', () => getBooksStorageDir());
ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('fs:read-epub', (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.epub')) {
    throw new Error('Only EPUB files can be opened');
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error('The EPUB file does not exist');
  }

  const buffer = fs.readFileSync(resolvedPath);
  return {
    name: path.basename(resolvedPath),
    path: resolvedPath,
    data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    size: buffer.length
  };
});

ipcMain.handle('window:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('window:is-fullscreen', () => Boolean(mainWindow?.isFullScreen()));

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// Application Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
