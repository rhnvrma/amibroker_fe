const { app, BrowserWindow } = require("electron");
const path = require("path");
const url = require("url");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load local Next.js export
  win.loadURL(
    url.format({
      pathname: path.join(__dirname, "out", "index.html"),
      protocol: "file:",
      slashes: true,
    })
  );
}

app.whenReady().then(createWindow);
