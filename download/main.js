// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const url = require("url");
const Store = require("electron-store");
const { loginToUpstox } = require("./src/lib/upstox-api");
const { fetchAndDecompressItems } = require("./src/lib/item-updater");
const fs = require('fs');
const { convertToCSV } = require("./src/lib/csv-utils");
const {convertToJson}=require("./src/lib/json_utils");
const winax = require('winax');
const { getTradingSymbol } = require('./backend_utils/symbolhelper');
const { sendToPipe } = require("./backend_utils/pipe_send");
const {  fetchAndStoreData } = require("./backend_utils/historical_data");
const log = require('electron-log');

// --- SETUP ELECTRON-LOG ---
// This overrides the default console.log behavior
// Now, any console.log statements in your main process will be written to a file.
console.log = log.log;
console.error = log.error;
console.warn = log.warn;
console.info = log.info;
const store = new Store();
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let loadingWindow;
let isQuitting = false; // Add this flag

function createLoadingScreen() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
  loadingWindow.on('closed', () => (loadingWindow = null));
  loadingWindow.webContents.on('did-finish-load', () => {
    loadingWindow.show();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Do not show initially
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    // Load the URL of the running Next.js dev server
    mainWindow.loadURL("http://localhost:9002");
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // Load the Next.js build
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "out", "index.html"),
        protocol: "file:",
        slashes: true,
      })
    );
    // mainWindow.setMenu(null);
  }
}

// IPC Handlers
ipcMain.on('app-ready', () => {
  if (loadingWindow) {
    loadingWindow.close();
  }
  mainWindow.show();
});

ipcMain.handle("login", async (event, credentials) => {
  const result = await loginToUpstox(credentials);
  if (result.success) {
    store.set("credentials", credentials);
    store.set("token", result.token);
    result.refreshedItems = await fetchAndDecompressItems();
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
    const credentials = store.get('credentials');
    const exportPath = credentials && credentials.rootFolder ? credentials.rootFolder : app.getPath('desktop');
    const filePath = path.join(exportPath, filename);
    fs.writeFileSync(filePath, csvData);
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Failed to export watchlist to CSV", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-access-token", () => {
  try {
    const token = store.get('token');
    if (!token) {
      throw new Error("No access token found in store.");
    }
    const credentials = store.get('credentials');
    const exportPath = credentials && credentials.rootFolder ? credentials.rootFolder : app.getPath('desktop');
    const filePath = path.join(exportPath, 'access_token.txt');
    console.log("Access Token saved in file in ", exportPath);
    fs.writeFileSync(filePath, token);
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Failed to save access token", error);
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
ipcMain.handle("export-watchlist-json",async  (event, { watchlist, filename }) => {
  let ab;
  try {
    store.set('last-active-watchlist', watchlist);
    // --- Part 1: Interact with the COM object using winax ---
    console.log("Connecting to Broker.Application...");
    ab = new winax.Object("Broker.Application", { activate: true });
    console.log("Successfully created a new instance.");

    console.log("Successfully connected. Processing watchlist...");

    // Assuming 'watchlist' is an array of objects, e.g., [{ trading_symbol: 'RELIANCE' }, ...]
    // If it's just an array of strings, use 'symbol' directly.
    // console.log(watchlist);
    
    watchlist['items'].forEach(item => {

      const symbol = getTradingSymbol(item);
      item.trading_symbol=symbol;      
    });
    
    console.log("Finished processing watchlist with COM object.");
    
    // --- Part 2: Your existing logic to save the file ---
    const jsonData = convertToJson(watchlist);
    const credentials = store.get('credentials');
    const exportPath = credentials && credentials.rootFolder ? credentials.rootFolder : app.getPath('desktop');
    const filePath = path.join(exportPath, filename);
    const backfillPath = path.join(exportPath, "data_backfill");
    try {
      // Ensure the root data directory exists before starting
      fs.mkdirSync(backfillPath, { recursive: true });
      console.log('info', `Data will be saved in '${backfillPath}' directory.`);
      
      // Call the main function with the list of items and the root path.
      await fetchAndStoreData(watchlist['items'], backfillPath);
    } catch (error) {
      console.log('error', `An unexpected top-level error occurred: ${error.stack}`);
    }
    watchlist['items'].forEach(item => {

      if (item.trading_symbol) {
        console.log(`Adding symbol: ${item.trading_symbol}`);
        let stk = ab.Stocks.Add(item.trading_symbol);
        stk.FullName = item.trading_symbol.replace(/\s+/g,'');
      } 
    });
    ab.SaveDatabase()
    fs.writeFileSync(filePath, jsonData);
    sendToPipe("MyTestPipe", "Final");
    console.log(`Watchlist successfully saved to ${filePath}`);
    // --- Part 3: Return success ---
    return { success: true, path: filePath, message: 'Watchlist processed and exported successfully.' };
    
  } catch (error) {
    console.error("An error occurred during watchlist processing:", error);
    return { success: false, error: error.message };
  }
  finally {
    // --- Release COM object properly ---
    if (ab) {
      try {
      // Release the main COM object and any other related COM objects
      // that you have created.
      winax.release(ab);
      console.log("Released COM object Broker.Application");
    } catch (releaseErr) {
      console.warn("Failed to release COM object cleanly:", releaseErr);
    }
    }
  }
});
// Window Controls
ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});
app.whenReady().then(() => {
  createLoadingScreen(); // Call the acreen first
  createWindow();
});
app.on("before-quit", async (event) => {
    if (isQuitting) {
        return;
    }
    event.preventDefault(); // Prevent the app from quitting immediately
    isQuitting = true;

    console.log("Preparing to quit. Starting background data backfill...");

    // Close all windows to give a visual indication that the app is closing
    BrowserWindow.getAllWindows().forEach(window => window.destroy());

    try {
        // 1. Retrieve the last known watchlist and credentials from the store
        const watchlist = store.get('last-active-watchlist');
        const credentials = store.get('credentials');

        // 2. Check if we have the necessary data to proceed
        if (!watchlist || !watchlist.items || watchlist.items.length === 0) {
            console.log("No watchlist found or watchlist is empty. Skipping backfill.");
            app.quit(); // Exit without doing anything
            return;
        }

        if (!credentials || !credentials.rootFolder) {
            console.error("Root folder not configured in credentials. Cannot perform backfill.");
            app.quit(); // Exit if config is missing
            return;
        }

        // 3. Construct the path for backfill data
        const backfillPath = path.join(credentials.rootFolder, "data_backfill");
        
        // Ensure the directory exists
        fs.mkdirSync(backfillPath, { recursive: true });
        console.log(`Data backfill will be saved in '${backfillPath}' directory.`);
        
        // 4. Execute the backfill operation
        console.log(`Starting backfill for ${watchlist.items.length} items...`);
        await fetchAndStoreData(watchlist.items, backfillPath);
        console.log("Background data backfill finished successfully.");

    } catch (error) {
        console.error('An error occurred during the pre-quit backfill process:', error.stack);
    } finally {
        console.log("Exiting application.");
        app.quit(); // Force the app to quit now
    }
});