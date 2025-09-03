const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getCredentials: () => ipcRenderer.invoke("get-credentials"),
  refreshItems: () => ipcRenderer.invoke("refresh-items"),
});