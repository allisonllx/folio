const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folio', {
  catalog: refresh => ipcRenderer.invoke('catalog', refresh),
  save: (id, patch) => ipcRenderer.invoke('save', id, patch),
  copy: text => ipcRenderer.invoke('copy', text),
  reveal: id => ipcRenderer.invoke('reveal', id)
});
