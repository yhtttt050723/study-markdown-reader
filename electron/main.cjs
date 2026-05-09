const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdc"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cursor",
  ".vscode",
  "md-reader-app",
  "软件",
]);

function collectMarkdownFiles(dirPath, rootDir = dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...collectMarkdownFiles(fullPath, rootDir));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (MARKDOWN_EXTENSIONS.has(ext)) {
      files.push({
        name: entry.name,
        fullPath,
        relativePath: path.relative(rootDir, fullPath),
      });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "public", "app-icon.ico");
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("list-markdown-files", async (_, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }
  return collectMarkdownFiles(dirPath);
});

ipcMain.handle("read-markdown-file", async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("文件不存在");
  }
  return fs.readFileSync(filePath, "utf-8");
});

ipcMain.handle("write-markdown-file", async (_, filePath, content) => {
  if (!filePath) {
    throw new Error("文件路径无效");
  }
  fs.writeFileSync(filePath, content ?? "", "utf-8");
  return true;
});

ipcMain.handle("read-local-image-as-data-url", async (_, imagePath) => {
  if (!imagePath || !fs.existsSync(imagePath)) {
    return null;
  }
  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const mime = mimeMap[ext];
  if (!mime) {
    return null;
  }
  const base64 = fs.readFileSync(imagePath).toString("base64");
  return `data:${mime};base64,${base64}`;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
