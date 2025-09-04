const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getCredentials: () => ipcRenderer.invoke("get-credentials"),
  refreshItems: () => ipcRenderer.invoke("refresh-items"),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  exportWatchlistCsv: (watchlist, filename) => ipcRenderer.invoke("export-watchlist-csv", { watchlist, filename }),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveCredentials: (data) => ipcRenderer.invoke('save-credentials', data),
  saveAccessToken: () => ipcRenderer.invoke('save-access-token'),
});