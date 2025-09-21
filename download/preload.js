const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getCredentials: () => ipcRenderer.invoke("get-credentials"),
  refreshItems: () => ipcRenderer.invoke("refresh-items"),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  exportWatchlistCsv: (watchlist, filename) => ipcRenderer.invoke("export-watchlist-csv", { watchlist, filename }),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveCredentials: (data) => ipcRenderer.invoke('save-credentials', data),
  saveAccessToken: () => ipcRenderer.invoke('save-access-token'),
  exportWatchlistJson: (watchlist, filename) => ipcRenderer.invoke("export-watchlist-json", { watchlist, filename }),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window')
});