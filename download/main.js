const { app, BrowserWindow, ipcMain,dialog  } = require("electron");
const path = require("path");
const url = require("url");
const Store = require("electron-store");
const { loginToUpstox } = require("./src/lib/upstox-api");
const { fetchAndDecompressItems } = require("./src/lib/item-updater");
const fs = require('fs');
const { convertToCSV } = require("./src/lib/csv-utils");

const store = new Store();
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    // Load the URL of the running Next.js dev server
    win.loadURL("http://localhost:9002");
    // Open the DevTools.
    win.webContents.openDevTools();
  } else {
    // Load the Next.js build
    win.loadURL(
      url.format({
        pathname: path.join(__dirname, "out", "index.html"),
        protocol: "file:",
        slashes: true,
      })
    );
  }
}

// Mock external login function
async function mockExternalLogin(credentials) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        token: `mock_token_${Date.now()}`,
        // Simulate a refreshed list of items
        refreshedItems: [
            { name: "NIFTY", segment: "NFO_OPT", underlying_symbol: "NIFTY", instrument_key: "NFO_OPT|53137", exchange_token: "53137", minimum_lot: 50, trading_symbol: "NIFTY 28MAR24 22000 CE", strike_price: 22000 },
            { name: "BANKNIFTY", segment: "NFO_OPT", underlying_symbol: "BANKNIFTY", instrument_key: "NFO_OPT|40042", exchange_token: "40042", minimum_lot: 15, trading_symbol: "BANKNIFTY 27MAR24 46500 CE", strike_price: 46500 },
        ],
      });
    }, 1000);
  });
}

// IPC Handlers
ipcMain.handle("login", async (event, credentials) => {
  const result = await loginToUpstox(credentials);
  if (result.success) {
    store.set("credentials", credentials);
    store.set("token", result.token);
  }
  return result;
});

ipcMain.handle("get-credentials", () => {
  return store.get("credentials");
});

ipcMain.handle("refresh-items", async () => {
    return await fetchAndDecompressItems();
});

ipcMain.handle("clear-store", () => {
  store.clear();
  return { success: true, message: "Credentials cleared." };
});

ipcMain.handle("export-watchlist-csv", (event, { watchlist, filename }) => {
  try {
    const csvData = convertToCSV(watchlist);
    const filePath = path.join(app.getAppPath(), '..', filename);
    fs.writeFileSync(filePath, csvData);
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Failed to export watchlist to CSV", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return;
  } else {
    return filePaths[0];
  }
});
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    console.log('Main Process: Received credentials to save:', credentials);
    // Add your logic here to save the credentials securely
    // For example, using electron-store:
    // store.set('user-credentials', credentials);

    return { success: true }; // Acknowledge that the save was successful
  } catch (error) {
    console.error('Failed to save credentials:', error);
    return { success: false, error: error.message };
  }
});
app.whenReady().then(createWindow);