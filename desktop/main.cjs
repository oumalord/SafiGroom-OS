const { app, BrowserWindow, shell } = require('electron');

const appUrl = require('../app-config.json').hostedUrl;
const appOrigin = new URL(appUrl).origin;

function openWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: `${__dirname}/../build/safigroom.ico`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && new URL(url).origin !== appOrigin) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== appOrigin) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(appUrl);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.safigroom.os.desktop');
  openWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
