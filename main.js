/* jshint esversion: 6 */

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const fs = require("fs");
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    minWidth: 700,
    minHeight: 400,
    width: 1000,
    height: 700,
    webPreferences: {
      experimentalFeatures: true
    }
  });
  //mainWindow.webContents.session.setProxy({ proxyRules: "socks5://213.32.72.118:1080" }, function () {
    mainWindow.loadURL(`file://${__dirname}/index.html`);
  //});
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('page-title-updated', () => {
    var url = mainWindow.webContents.getURL();
    if (/vk\.com\/feed/i.test(url)) {
      mainWindow.webContents.session.cookies.get({}, (error, cookies) => {
        var cookieObj = {};
        cookies.filter((e) => e.domain == ".vk.com").forEach((e) => {
          cookieObj[e.name] = e.value;
        });
        mainWindow.webContents.session.clearStorageData(() => {
          fs.writeFile(path.join(__dirname, "data/cookies"), JSON.stringify(cookieObj), (e, d) => {
            if (e) throw e;
            mainWindow.loadURL(`file://${__dirname}/index.html`);
          });
        });
      });
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});