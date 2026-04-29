import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import "./App.css";

const QUICK_TEMPLATES = {
  wrongbook: {
    label: "错题快速录入",
    fields: [
      { key: "date", label: "日期" },
      { key: "subject", label: "科目" },
      { key: "chapter", label: "章节" },
      { key: "source", label: "来源" },
      { key: "question", label: "原题" },
      { key: "wrong", label: "错误解法" },
      { key: "correct", label: "正确要点" },
    ],
    build: (v) => `## 题目：${v.chapter || "未命名题目"}
- 日期：${v.date || ""}
- 科目：${v.subject || ""}
- 章节：${v.chapter || ""}
- 来源：${v.source || ""}

### 原题
${v.question || ""}

### 我的错误解法
${v.wrong || ""}

### 正确解法/要点
${v.correct || ""}

### 错因
- [ ] 概念
- [ ] 计算
- [ ] 审题
- [ ] 方法

### 二刷结果
- 二刷日期：
- 是否通过：`,
  },
  daily: {
    label: "每日日报快速录入",
    fields: [
      { key: "date", label: "日期" },
      { key: "score", label: "今日总评(1-10)" },
      { key: "done", label: "今日完成(简写)" },
      { key: "issues", label: "今日3个卡点" },
      { key: "next", label: "明日第一优先" },
    ],
    build: (v) => `# 每日日报 ${v.date || ""}

- 今日总评：${v.score || ""}
- 今日完成：${v.done || ""}
- 今日3个卡点：${v.issues || ""}
- 明日第一优先：${v.next || ""}`,
  },
  dayclear: {
    label: "日清快速录入",
    fields: [
      { key: "date", label: "日期" },
      { key: "a", label: "关键块1" },
      { key: "b", label: "关键块2" },
      { key: "best", label: "最有效动作" },
      { key: "next", label: "明日第一优先" },
    ],
    build: (v) => `## 日清 ${v.date || ""}
- 关键块1：${v.a || ""}
- 关键块2：${v.b || ""}
- 最有效动作：${v.best || ""}
- 明日第一优先：${v.next || ""}`,
  },
  weekly: {
    label: "周报快速录入",
    fields: [
      { key: "range", label: "周期" },
      { key: "total", label: "总分(13分制)" },
      { key: "good", label: "本周3个有效动作" },
      { key: "bad", label: "本周3个卡点" },
      { key: "next", label: "下周调整" },
    ],
    build: (v) => `## 周报 ${v.range || ""}
- 总分：${v.total || ""}
- 本周有效动作：${v.good || ""}
- 本周主要卡点：${v.bad || ""}
- 下周调整：${v.next || ""}`,
  },
};

function App() {
  const [folderPath, setFolderPath] = useState("");
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState("split");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("electron");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [quickType, setQuickType] = useState("wrongbook");
  const [quickValues, setQuickValues] = useState({});
  const webInputRef = useRef(null);
  const editorRef = useRef(null);
  marked.setOptions({
    gfm: true,
    breaks: true,
  });


  const hasApi = useMemo(() => Boolean(window.electronAPI), []);
  const canNativeSave = useMemo(
    () =>
      Boolean(
        window.electronAPI &&
          typeof window.electronAPI.writeMarkdownFile === "function"
      ),
    []
  );

  const groupedFiles = useMemo(() => {
    const groups = {};
    for (const file of files) {
      const normalized = file.relativePath.replaceAll("\\", "/");
      const group = normalized.includes("/") ? normalized.split("/")[0] : "根目录";
      if (!groups[group]) groups[group] = [];
      groups[group].push(file);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }
    return groups;
  }, [files]);

  const openWebFile = async (file) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const fileContent = await file.text();
      setContent(fileContent);
      setActiveFile({
        name: file.name,
        fullPath: file.webkitRelativePath || file.name,
        relativePath: file.webkitRelativePath || file.name,
        fileObject: file,
      });
      setDirty(false);
    } catch (err) {
      setError(err.message || "读取文件失败");
    } finally {
      setLoading(false);
    }
  };

  const openFolder = async () => {
    if (!hasApi) {
      setMode("browser");
      webInputRef.current?.click();
      return;
    }

    setMode("electron");

    setError("");
    setMessage("");
    const pickedPath = await window.electronAPI.pickDirectory();
    if (!pickedPath) {
      return;
    }

    setFolderPath(pickedPath);
    setLoading(true);
    try {
      const markdownFiles = await window.electronAPI.listMarkdownFiles(pickedPath);
      setFiles(markdownFiles);
      if (markdownFiles.length > 0) {
        await openFile(markdownFiles[0]);
        const seed = {};
        for (const f of markdownFiles) {
          const normalized = f.relativePath.replaceAll("\\", "/");
          const group = normalized.includes("/") ? normalized.split("/")[0] : "根目录";
          seed[group] = true;
        }
        setExpandedGroups(seed);
      } else {
        setActiveFile(null);
        setContent("");
      }
    } catch (err) {
      setError(err.message || "读取文件夹失败");
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (file) => {
    setActiveFile(file);
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const fileContent = await window.electronAPI.readMarkdownFile(file.fullPath);
      setContent(fileContent);
      setDirty(false);
    } catch (err) {
      setError(err.message || "读取文件失败");
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  const onWebFolderChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const markdownFiles = selectedFiles
      .filter((file) => {
        const lower = file.name.toLowerCase();
        return lower.endsWith(".md") || lower.endsWith(".mdc");
      })
      .map((file) => ({
        name: file.name,
        fullPath: file.webkitRelativePath || file.name,
        relativePath: file.webkitRelativePath || file.name,
        fileObject: file,
      }))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    setFiles(markdownFiles);
    setFolderPath(
      markdownFiles[0]?.relativePath?.split("/")[0] || "浏览器选择的文件夹"
    );

    if (markdownFiles.length > 0) {
      await openWebFile(markdownFiles[0].fileObject);
      const seed = {};
      for (const f of markdownFiles) {
        const normalized = f.relativePath.replaceAll("\\", "/");
        const group = normalized.includes("/") ? normalized.split("/")[0] : "根目录";
        seed[group] = true;
      }
      setExpandedGroups(seed);
    } else {
      setActiveFile(null);
      setContent("");
      setError("未找到 .md 或 .mdc 文件。");
    }
  };

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const saveContent = async () => {
    if (!activeFile) return;
    setError("");
    setMessage("");
    try {
      if (mode === "electron" && canNativeSave) {
        await window.electronAPI.writeMarkdownFile(activeFile.fullPath, content);
      } else {
        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = activeFile.name || "edited.md";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }
      setDirty(false);
      setMessage(canNativeSave ? "保存成功" : "已下载文件（当前为兼容保存模式）");
      setViewMode("split");
    } catch (err) {
      setError(err.message || "保存失败");
    }
  };

  const onQuickValueChange = (key, value) => {
    setQuickValues((prev) => ({ ...prev, [key]: value }));
  };

  const insertQuickTemplate = () => {
    const template = QUICK_TEMPLATES[quickType];
    if (!template) return;
    const block = template.build(quickValues).trim();
    const merged = content.trim() ? `${content.trim()}\n\n${block}\n` : `${block}\n`;
    setContent(merged);
    setDirty(true);
    setMessage(`已插入：${template.label}`);
  };

  useEffect(() => {
    const onGlobalKeydown = (event) => {
      if (!activeFile) return;
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta) return;

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        editorRef.current?.focus();
        document.execCommand("undo");
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        editorRef.current?.focus();
        document.execCommand("redo");
        return;
      }

      if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        saveContent();
      }
    };

    window.addEventListener("keydown", onGlobalKeydown);
    return () => window.removeEventListener("keydown", onGlobalKeydown);
  }, [activeFile, content, dirty, mode, canNativeSave]);

  return (
    <div className="app">
      <input
        ref={webInputRef}
        type="file"
        className="hidden-input"
        webkitdirectory="true"
        directory=""
        multiple
        onChange={onWebFolderChange}
      />
      <header className="topbar">
        <button type="button" onClick={openFolder}>
          {hasApi ? "打开文件夹" : "选择文件夹（浏览器模式）"}
        </button>
        <button type="button" onClick={saveContent} disabled={!activeFile || !dirty}>
          保存
        </button>
        <div className="view-switch">
          <button
            type="button"
            className={viewMode === "split" ? "selected" : ""}
            onClick={() => setViewMode("split")}
          >
            分栏
          </button>
          <button
            type="button"
            className={viewMode === "edit" ? "selected" : ""}
            onClick={() => setViewMode("edit")}
          >
            编辑
          </button>
          <button
            type="button"
            className={viewMode === "preview" ? "selected" : ""}
            onClick={() => setViewMode("preview")}
          >
            预览
          </button>
        </div>
        <div className="folder-path">{folderPath || "尚未选择文件夹"}</div>
        {dirty && <span className="dirty">未保存</span>}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2>Markdown 文件树</h2>
          {files.length === 0 && (
            <p className="hint">
              支持 `.md` 和 `.mdc`
              {!hasApi ? "（当前是浏览器模式）" : ""}
            </p>
          )}
          {Object.keys(groupedFiles)
            .sort((a, b) => a.localeCompare(b))
            .map((group) => (
              <div key={group} className="tree-group">
                <button
                  type="button"
                  className="group-btn"
                  onClick={() => toggleGroup(group)}
                >
                  {expandedGroups[group] ? "▾" : "▸"} {group}
                </button>
                {expandedGroups[group] && (
                  <ul>
                    {groupedFiles[group].map((file) => (
                      <li key={file.fullPath}>
                        <button
                          type="button"
                          className={
                            activeFile?.fullPath === file.fullPath ? "active" : ""
                          }
                          onClick={() =>
                            mode === "browser"
                              ? openWebFile(file.fileObject)
                              : openFile(file)
                          }
                        >
                          {file.relativePath.replaceAll("\\", "/")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          <div className="quick-panel">
            <h3>快速录入</h3>
            <select
              value={quickType}
              onChange={(e) => {
                setQuickType(e.target.value);
                setQuickValues({});
              }}
            >
              {Object.entries(QUICK_TEMPLATES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
            {QUICK_TEMPLATES[quickType].fields.map((field) => (
              <label key={field.key} className="quick-field">
                <span>{field.label}</span>
                <input
                  value={quickValues[field.key] || ""}
                  onChange={(e) => onQuickValueChange(field.key, e.target.value)}
                />
              </label>
            ))}
            <button type="button" onClick={insertQuickTemplate}>
              插入到编辑区
            </button>
          </div>
        </aside>

        <main className={`viewer ${viewMode}`}>
          {loading && <p className="hint">加载中...</p>}
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          {!loading && !error && !activeFile && (
            <p className="hint">请选择一个文件夹并点击左侧文件查看内容。</p>
          )}
          {!loading && !error && activeFile && viewMode !== "preview" && (
            <textarea
              ref={editorRef}
              className="editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
            />
          )}
          {!loading && !error && activeFile && viewMode !== "edit" && (
            <article
              className="markdown"
              dangerouslySetInnerHTML={{ __html: marked.parse(content || "") }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
