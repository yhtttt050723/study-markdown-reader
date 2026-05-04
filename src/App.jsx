import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import "./App.css";

/** 错题预览 / 随机刷题：不展示答案（纸质版自持） */
function stripAnswerSectionsForPractice(md) {
  let s = md || "";
  s = s.replace(
    /####\s*正确答案与解析[\s\S]*?(?=\n#### |\n###\s*题目[:：]|$)/gi,
    ""
  );
  s = s.replace(/####\s*答案[\s\S]*?(?=\n#### |\n###\s*题目[:：]|$)/gi, "");
  s = s.replace(
    /###\s*正确解法[^\n]*[\s\S]*?(?=\n### |\n#### |\n###\s*题目[:：]|$)/gi,
    ""
  );
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function injectLocalQuestionImages(md, imageDataMap) {
  return (md || "").replace(
    /- 题目图片：([^\n]+(?:\.png|\.jpg|\.jpeg|\.webp|\.gif))/gi,
    (_m, p1) => {
      const rawPath = p1.trim();
      const dataUrl = imageDataMap[rawPath];
      const fallbackPath = rawPath.replaceAll("\\", "/");
      const fallbackUrl = fallbackPath.startsWith("file:///")
        ? fallbackPath
        : `file:///${fallbackPath.replace(/^\/+/, "")}`;
      const displayUrl = dataUrl || fallbackUrl;
      return `- 题目图片：${rawPath}\n\n![题目截图](${displayUrl})`;
    }
  );
}

function splitWrongBookBlocks(text) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const chunks = t.split(/(?=^###\s*题目[:：]|^##\s*题目[:：])/m);
  return chunks.filter(
    (c) => /^###\s*题目[:：]/m.test(c) || /^##\s*题目[:：]/m.test(c)
  );
}

function parseWrongBlock(block, fileLabel) {
  const tm =
    block.match(/^###\s*题目[:：]\s*(.+)$/m) || block.match(/^##\s*题目[:：]\s*(.+)$/m);
  const dm = block.match(/^-\s*日期[:：]\s*(.+)$/m);
  const sm = block.match(/^-\s*来源[:：]\s*(.+)$/m);
  const im = block.match(/^-\s*题目图片[:：]\s*(.+)$/m);
  const title = tm ? tm[1].trim() : "未命名";
  const imagePath = im
    ? im[1].trim().replace(/^["']|["']$/g, "").replaceAll("/", "\\")
    : "";
  return {
    fileLabel,
    title,
    firstDate: dm ? dm[1].trim() : "—",
    source: sm ? sm[1].trim() : "—",
    imagePath,
    bodyForQuiz: stripAnswerSectionsForPractice(block),
  };
}

function isWrongBookFile(file) {
  const rp = (file.relativePath || "").replaceAll("\\", "/");
  if (rp.includes("二刷计划")) return false;
  if (!file.name?.includes("错题")) return false;
  if (!/\.md$/i.test(file.name || "")) return false;
  return true;
}

const QUICK_TEMPLATES = {
  wrongbook: {
    label: "错题快速录入",
    fields: [
      { key: "date", label: "日期" },
      { key: "subject", label: "科目" },
      { key: "chapter", label: "章节" },
      { key: "source", label: "来源" },
      { key: "image", label: "题目图片路径" },
      { key: "question", label: "原题" },
      { key: "wrong", label: "错误解法" },
    ],
    build: (v) => `### 题目：${v.chapter || "未命名题目"}
- 日期：${v.date || ""}
- 科目：${v.subject || ""}
- 章节：${v.chapter || ""}
- 来源：${v.source || ""}
- 题目图片：${v.image || ""}

#### 原题（OCR整理）
${v.question || ""}

#### 我的作答（从截图提取）
${v.wrong || ""}

#### 错因分析
- 错因标签：
- 本次错误点：

#### 下次避免策略
1.
2.

#### 二刷计划
- 二刷时间：
- 二刷标准：`,
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

const PRE_STUDY_TASKS = [
  "30秒呼吸复位：缓慢吸气4秒-呼气6秒，共5轮。",
  "写下1句事实：我现在感到焦虑，但我依然可以先做25分钟。",
  "开学习计时器25分钟，只承诺完成“第一小步”。",
];

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
  const [imageDataMap, setImageDataMap] = useState({});
  const [preStudyChecks, setPreStudyChecks] = useState([false, false, false]);
  const [randomQuizOpen, setRandomQuizOpen] = useState(false);
  const [randomQuizItem, setRandomQuizItem] = useState(null);
  const [randomQuizImageData, setRandomQuizImageData] = useState(null);
  const wrongBlocksPoolRef = useRef([]);
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

  useEffect(() => {
    const loadImages = async () => {
      const matches = Array.from(
        (content || "").matchAll(
          /- 题目图片：([^\n]+(?:\.png|\.jpg|\.jpeg|\.webp|\.gif))/gi
        )
      );
      const imagePaths = [...new Set(matches.map((m) => m[1].trim()))];
      if (!imagePaths.length || !window.electronAPI?.readLocalImageAsDataUrl) {
        setImageDataMap({});
        return;
      }
      const entries = await Promise.all(
        imagePaths.map(async (p) => {
          const normalized = p.replaceAll("/", "\\");
          const dataUrl = await window.electronAPI.readLocalImageAsDataUrl(normalized);
          return [p, dataUrl];
        })
      );
      setImageDataMap(Object.fromEntries(entries.filter(([, data]) => Boolean(data))));
    };
    loadImages();
  }, [content]);

  useEffect(() => {
    const path = randomQuizItem?.imagePath;
    if (!path || !window.electronAPI?.readLocalImageAsDataUrl) {
      setRandomQuizImageData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const normalized = path.replaceAll("/", "\\");
      const dataUrl = await window.electronAPI.readLocalImageAsDataUrl(normalized);
      if (!cancelled) setRandomQuizImageData(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [randomQuizItem]);

  useEffect(() => {
    if (!randomQuizOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setRandomQuizOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [randomQuizOpen]);

  const previewMarkdown = useMemo(() => {
    let raw = content || "";
    if (activeFile?.name?.includes("错题")) {
      raw = stripAnswerSectionsForPractice(raw);
    }
    return injectLocalQuestionImages(raw, imageDataMap);
  }, [content, activeFile, imageDataMap]);

  const randomQuizHtml = useMemo(() => {
    if (!randomQuizItem) return "";
    const map =
      randomQuizImageData && randomQuizItem.imagePath
        ? { [randomQuizItem.imagePath]: randomQuizImageData }
        : {};
    const raw = injectLocalQuestionImages(randomQuizItem.bodyForQuiz || "", map);
    return marked.parse(raw);
  }, [randomQuizItem, randomQuizImageData]);

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

  const refreshUi = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "electron" && hasApi && folderPath) {
        const markdownFiles = await window.electronAPI.listMarkdownFiles(folderPath);
        setFiles(markdownFiles);
        if (activeFile?.fullPath) {
          const latest = markdownFiles.find((f) => f.fullPath === activeFile.fullPath);
          if (latest) {
            await openFile(latest);
          }
        }
      }
      setMessage("UI已刷新");
    } catch (err) {
      setError(err.message || "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  const pickRandomFromPool = () => {
    const pool = wrongBlocksPoolRef.current;
    if (!pool.length) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    setRandomQuizItem(item);
  };

  const openRandomQuiz = async () => {
    setError("");
    setMessage("");
    if (!files.length) {
      setError("请先打开文件夹（建议选 Study 根目录）");
      return;
    }
    const wrongFiles = files.filter(isWrongBookFile);
    if (!wrongFiles.length) {
      setError("未找到错题本：需要文件名含「错题」的 .md，且不在「二刷计划」目录下");
      return;
    }
    setLoading(true);
    try {
      const blocks = [];
      for (const f of wrongFiles) {
        let txt = "";
        if (mode === "electron" && window.electronAPI?.readMarkdownFile) {
          txt = await window.electronAPI.readMarkdownFile(f.fullPath);
        } else if (f.fileObject) {
          txt = await f.fileObject.text();
        } else {
          continue;
        }
        const rp = f.relativePath.replaceAll("\\", "/");
        splitWrongBookBlocks(txt).forEach((b) => blocks.push(parseWrongBlock(b, rp)));
      }
      if (!blocks.length) {
        setError("错题本中未找到「### 题目：」或「## 题目：」格式的条目");
        setLoading(false);
        return;
      }
      wrongBlocksPoolRef.current = blocks;
      const item = blocks[Math.floor(Math.random() * blocks.length)];
      setRandomQuizItem(item);
      setRandomQuizOpen(true);
      setMessage(`已加载 ${blocks.length} 道错题，随机展示中（不显示答案）`);
    } catch (err) {
      setError(err.message || "随机刷题加载失败");
    } finally {
      setLoading(false);
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

  const togglePreStudyCheck = (index) => {
    setPreStudyChecks((prev) => prev.map((item, i) => (i === index ? !item : item)));
  };

  const resetPreStudyChecks = () => {
    setPreStudyChecks([false, false, false]);
    setMessage("已重置：学习前3步复位");
  };

  const insertPreStudyChecklist = () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const lines = PRE_STUDY_TASKS.map(
      (task, i) => `- [${preStudyChecks[i] ? "x" : " "}] ${task}`
    );
    const block = [`## 学习前3步复位（${stamp}）`, "", ...lines, ""].join("\n").trim();
    const merged = content.trim() ? `${content.trim()}\n\n${block}\n` : `${block}\n`;
    setContent(merged);
    setDirty(true);
    setMessage("已插入：学习前3步复位");
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
        <button type="button" onClick={refreshUi}>
          刷新UI
        </button>
        <button type="button" onClick={openRandomQuiz}>
          随机刷题
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
            <h3>学习前复位</h3>
            <div className="prestudy-card">
              {PRE_STUDY_TASKS.map((task, index) => (
                <label key={task} className="prestudy-item">
                  <input
                    type="checkbox"
                    checked={preStudyChecks[index]}
                    onChange={() => togglePreStudyCheck(index)}
                  />
                  <span>{task}</span>
                </label>
              ))}
              <div className="prestudy-actions">
                <button type="button" onClick={insertPreStudyChecklist}>
                  插入到编辑区
                </button>
                <button type="button" className="ghost-btn" onClick={resetPreStudyChecks}>
                  重置勾选
                </button>
              </div>
            </div>
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
              dangerouslySetInnerHTML={{ __html: marked.parse(previewMarkdown || "") }}
            />
          )}
        </main>
      </div>

      {randomQuizOpen && randomQuizItem && (
        <div
          className="quiz-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quiz-dialog-title"
        >
          <div className="quiz-panel">
            <div className="quiz-toolbar">
              <h2 id="quiz-dialog-title" className="quiz-title">
                随机刷题
              </h2>
              <div className="quiz-toolbar-btns">
                <button type="button" onClick={pickRandomFromPool}>
                  换一题
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setRandomQuizOpen(false)}
                >
                  关闭（Esc）
                </button>
              </div>
            </div>
            <div className="quiz-meta">
              <p>
                <strong>首次录入日期</strong>（错题内「日期」字段）：{randomQuizItem.firstDate}
              </p>
              <p>
                <strong>出处</strong>：{randomQuizItem.source}
              </p>
              <p>
                <strong>文件</strong>：{randomQuizItem.fileLabel}
              </p>
              <p>
                <strong>题目标题</strong>：{randomQuizItem.title}
              </p>
              <p className="quiz-hint">答案见纸质版；本窗口与错题本预览均不展示解析正文。</p>
            </div>
            <article
              className="markdown quiz-body"
              dangerouslySetInnerHTML={{ __html: randomQuizHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
