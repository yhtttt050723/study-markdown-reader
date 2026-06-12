const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  defaultStudyFolder: () => ipcRenderer.invoke("default-study-folder"),
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  listMarkdownFiles: (dirPath) => ipcRenderer.invoke("list-markdown-files", dirPath),
  readMarkdownFile: (filePath) => ipcRenderer.invoke("read-markdown-file", filePath),
  writeMarkdownFile: (filePath, content) =>
    ipcRenderer.invoke("write-markdown-file", filePath, content),
  readLocalImageAsDataUrl: (imagePath) =>
    ipcRenderer.invoke("read-local-image-as-data-url", imagePath),
  /** 学习笔记：剪贴板图片落盘 userData/quick-notes-assets/{noteId}/，返回绝对路径 */
  saveNotePasteImage: (payload) => ipcRenderer.invoke("save-note-paste-image", payload),
  /** 刷题日志持久化（userData/smr-quiz-log.json），与 localStorage `smr-quiz-log` 同步 */
  readQuizLogFile: () => ipcRenderer.invoke("read-quiz-log"),
  writeQuizLogFile: (jsonString) => ipcRenderer.invoke("write-quiz-log", jsonString),
});
