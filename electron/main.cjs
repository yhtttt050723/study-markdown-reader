const { app, BrowserWindow, dialog, ipcMain, Menu, protocol } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

/** 与渲染层 markdownQuiz 一致：旧路径 X:\Study\错题截图 → 补试 X:\Study\学习资料\错题截图 */
const STUDY_ROOT_MOVED_FIRST_SEGMENTS = new Set([
  "temp_wrongshots",
  "错题截图",
  "数学",
  "英语错题",
  "408",
  "考研择校",
  "二刷计划",
  "学习计划",
  "MDC归档",
]);

function tryInsertStudyMaterialsMirrorMain(canonPath) {
  const canon = path.normalize((canonPath || "").trim()).replace(/\//g, "\\");
  const m = canon.match(/^([a-zA-Z]:\\[^\\]+)\\([^\\]+)(\\.+)$/);
  if (!m) return null;
  const base = m[1];
  const first = m[2];
  const tail = m[3].replace(/^\\/, "");
  if (first === "学习资料") return null;
  if (!STUDY_ROOT_MOVED_FIRST_SEGMENTS.has(first)) return null;
  if (["周期记录", "电子书", "软件"].includes(first)) return null;
  return `${base}\\学习资料\\${first}\\${tail}`;
}

function resolveExistingImagePath(requestedPath) {
  const n = path.normalize((requestedPath || "").trim());
  if (!n) return null;
  const candidates = [n.replace(/\//g, "\\")];
  const mirrored = tryInsertStudyMaterialsMirrorMain(candidates[0]);
  if (mirrored) candidates.push(mirrored);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "smr-img",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

/** 与渲染进程 localStorage 键 `smr-quiz-log` 对应；持久化到磁盘避免仅依赖 localStorage 在部分环境下丢失 */
const QUIZ_LOG_FILENAME = "smr-quiz-log.json";

function getQuizLogPath() {
  return path.join(app.getPath("userData"), QUIZ_LOG_FILENAME);
}

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

/** 注册标准「编辑」菜单，确保 Ctrl+C / Ctrl+V / Ctrl+X 等走系统剪贴板（无菜单时部分环境快捷键异常） */
/**
 * 本地首次启动时尝试默认打开的「Study」根目录（浏览器 / 云端不设默认）。
 * 可通过环境变量 SMR_DEFAULT_STUDY_ROOT 覆盖；否则依次探测常见路径。
 */
function resolveDefaultStudyFolder() {
  const candidates = [];
  const env = process.env.SMR_DEFAULT_STUDY_ROOT?.trim();
  if (env) candidates.push(env);
  if (process.platform === "win32") {
    candidates.push("D:\\Study");
  }
  candidates.push(path.join(os.homedir(), "Study"));
  candidates.push(path.join(os.homedir(), "Documents", "Study"));
  const seen = new Set();
  for (const p of candidates) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function installApplicationMenu() {
  const isMac = process.platform === "darwin";
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
      /** 本地错题图走 smr-img:// 自定义协议，无需关闭 webSecurity */
      webSecurity: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("default-study-folder", () => resolveDefaultStudyFolder());

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

/**
 * 学习笔记粘贴图片：写入 userData/quick-notes-assets/{noteId}/，返回绝对路径（供 smr-img）。
 * @param {{ noteId: string, base64: string, ext?: string }} payload
 */
ipcMain.handle("save-note-paste-image", async (_, payload) => {
  const id = String(payload?.noteId || "")
    .replace(/[^\w.-]/g, "_")
    .slice(0, 120);
  if (!id) {
    throw new Error("noteId 无效");
  }
  let ext = String(payload?.ext || ".png").toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    ext = ".png";
  }
  const b64 = String(payload?.base64 || "");
  if (!b64) {
    throw new Error("无图片数据");
  }
  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new Error("图片数据解码失败");
  }
  if (!buf.length || buf.length > 12 * 1024 * 1024) {
    throw new Error("图片过大或未识别");
  }
  const dir = path.join(app.getPath("userData"), "quick-notes-assets", id);
  fs.mkdirSync(dir, { recursive: true });
  const name = `paste-${Date.now()}${ext}`;
  const full = path.join(dir, name);
  fs.writeFileSync(full, buf);
  return full;
});

ipcMain.handle("read-local-image-as-data-url", async (_, imagePath) => {
  const normalized = path.normalize((imagePath || "").trim());
  if (!normalized || !fs.existsSync(normalized)) {
    return null;
  }
  const ext = path.extname(normalized).toLowerCase();
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
  const base64 = fs.readFileSync(normalized).toString("base64");
  return `data:${mime};base64,${base64}`;
});

ipcMain.handle("read-quiz-log", async () => {
  try {
    const p = getQuizLogPath();
    if (!fs.existsSync(p)) {
      return [];
    }
    const raw = fs.readFileSync(p, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("read-quiz-log", e);
    return [];
  }
});

ipcMain.handle("write-quiz-log", async (_, jsonString) => {
  try {
    const p = getQuizLogPath();
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, jsonString ?? "[]", "utf-8");
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    console.error("write-quiz-log", e);
    return false;
  }
});

app.whenReady().then(() => {
  protocol.handle("smr-img", async (request) => {
    try {
      const u = new URL(request.url);
      if (u.hostname !== "dir") {
        return new Response("Forbidden", { status: 403 });
      }
      const seg = u.pathname.replace(/^\/+/, "");
      if (!seg) {
        return new Response("Bad Request", { status: 400 });
      }
      let fsPath;
      try {
        fsPath = Buffer.from(seg, "base64url").toString("utf8");
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      const resolved = resolveExistingImagePath(fsPath);
      if (!resolved) {
        return new Response("Not Found", { status: 404 });
      }
      const ext = path.extname(resolved).toLowerCase();
      const mimeMap = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      const mime = mimeMap[ext];
      if (!mime) {
        return new Response("Unsupported", { status: 415 });
      }
      const buf = fs.readFileSync(resolved);
      return new Response(buf, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (e) {
      console.error("smr-img", e);
      return new Response("Error", { status: 500 });
    }
  });

  installApplicationMenu();
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
