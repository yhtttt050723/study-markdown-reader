const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  listMarkdownFiles: (dirPath) => ipcRenderer.invoke("list-markdown-files", dirPath),
  readMarkdownFile: (filePath) => ipcRenderer.invoke("read-markdown-file", filePath),
  writeMarkdownFile: (filePath, content) =>
    ipcRenderer.invoke("write-markdown-file", filePath, content),
  readLocalImageAsDataUrl: (imagePath) =>
    ipcRenderer.invoke("read-local-image-as-data-url", imagePath),
});
