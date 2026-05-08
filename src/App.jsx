import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import "./App.css";
import {
  LS_SECOND_PLAN_FOCUS,
  LS_QUIZ_FILE_ONLY,
  LS_SIDEBAR_W,
  LS_SPLIT_RATIO,
  readStoredNumber,
  tryGetLocalStorage,
  trySetLocalStorage,
} from "./storageKeys.js";
import {
  appendQuizLog,
  buildExpandedGroupsSeed,
  filterQuizPool,
  formatElapsed,
  injectLocalQuestionImages,
  isSecondPassPlanFile,
  isWrongBookFile,
  normalizeRelPath,
  parseSecondPassBlock,
  parseWrongBlock,
  QUIZ_SUBJECT_PRESETS,
  readMarkdownFileText,
  resolveSecondPlanFocusRel,
  splitSecondPassBlocks,
  splitWrongBookBlocks,
  stripAnswerSectionsForPractice,
} from "./markdownQuiz.js";

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
  const [quizFullPool, setQuizFullPool] = useState([]);
  const [quizSelectedFolders, setQuizSelectedFolders] = useState([]);
  const [quizSelectedSubjects, setQuizSelectedSubjects] = useState([]);
  const [quizSourceWrong, setQuizSourceWrong] = useState(true);
  const [quizSourceSecond, setQuizSourceSecond] = useState(true);
  const [quizSecondPlanFocus, setQuizSecondPlanFocus] = useState("");
  const [quizFileOnlyMode, setQuizFileOnlyMode] = useState(false);
  const [quizElapsedSec, setQuizElapsedSec] = useState(0);
  const quizStartedAtRef = useRef(0);
  const webInputRef = useRef(null);
  const editorRef = useRef(null);
  const viewerSplitRef = useRef(null);

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredNumber(LS_SIDEBAR_W, 320, 200, 720)
  );
  const [splitRatio, setSplitRatio] = useState(() =>
    readStoredNumber(LS_SPLIT_RATIO, 0.5, 0.18, 0.82)
  );

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
      const normalized = normalizeRelPath(file.relativePath);
      const group = normalized.includes("/") ? normalized.split("/")[0] : "根目录";
      if (!groups[group]) groups[group] = [];
      groups[group].push(file);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }
    return groups;
  }, [files]);

  const secondPlanRelPaths = useMemo(() => {
    return files
      .filter(isSecondPassPlanFile)
      .map((f) => normalizeRelPath(f.relativePath))
      .sort((a, b) => b.localeCompare(a, "zh-CN"));
  }, [files]);

  const quizFolderOptions = useMemo(() => {
    const s = new Set(quizFullPool.map((it) => it.folderTag));
    return [...s].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [quizFullPool]);

  const quizSubjectOptions = useMemo(() => {
    const fromPool = new Set(
      quizFullPool
        .map((it) => (it.subject || "").trim())
        .filter(Boolean)
    );
    QUIZ_SUBJECT_PRESETS.forEach((p) => fromPool.add(p));
    const rest = [...fromPool].filter((s) => !QUIZ_SUBJECT_PRESETS.includes(s));
    rest.sort((a, b) => a.localeCompare(b, "zh-CN"));
    return [...QUIZ_SUBJECT_PRESETS, ...rest];
  }, [quizFullPool]);

  const quizFilteredPool = useMemo(() => {
    return filterQuizPool(quizFullPool, {
      quizSourceWrong,
      quizSourceSecond,
      quizSelectedFolders,
      quizSelectedSubjects,
      quizSecondPlanFocus,
      quizFileOnlyMode,
    });
  }, [
    quizFullPool,
    quizSourceWrong,
    quizSourceSecond,
    quizSelectedFolders,
    quizSelectedSubjects,
    quizSecondPlanFocus,
    quizFileOnlyMode,
  ]);

  useEffect(() => {
    if (!randomQuizOpen || !randomQuizItem) return;
    quizStartedAtRef.current = Date.now();
    setQuizElapsedSec(0);
    const tick = () =>
      setQuizElapsedSec(Math.floor((Date.now() - quizStartedAtRef.current) / 1000));
    const id = window.setInterval(tick, 500);
    tick();
    return () => window.clearInterval(id);
  }, [randomQuizOpen, randomQuizItem?.id]);

  useEffect(() => {
    if (!randomQuizOpen || !randomQuizItem?.id || !quizFilteredPool.length) return;
    const still = quizFilteredPool.some((x) => x.id === randomQuizItem.id);
    if (!still) {
      setMessage("当前题目不在筛选范围内，请点「换一题」。");
    }
  }, [quizFilteredPool, randomQuizItem, randomQuizOpen]);

  useEffect(() => {
    if (!quizFileOnlyMode || !secondPlanRelPaths.length) return;
    if (
      !quizSecondPlanFocus ||
      !secondPlanRelPaths.includes(quizSecondPlanFocus)
    ) {
      const fix = secondPlanRelPaths[0];
      setQuizSecondPlanFocus(fix);
      trySetLocalStorage(LS_SECOND_PLAN_FOCUS, fix);
    }
  }, [quizFileOnlyMode, quizSecondPlanFocus, secondPlanRelPaths]);

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
        setExpandedGroups(buildExpandedGroupsSeed(markdownFiles));
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
    if (typeof window.electronAPI?.readMarkdownFile !== "function") {
      setError("当前环境无法读取文件");
      setContent("");
      setLoading(false);
      return;
    }
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
      setExpandedGroups(buildExpandedGroupsSeed(markdownFiles));
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
    const pool = quizFilteredPool;
    if (!pool.length) {
      setError(
        "筛选后无题目：请勾选来源 / 调整文件夹筛选，或开启「文件内刷题」并选择某一 .md。"
      );
      return;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    setRandomQuizItem(item);
  };

  const recordQuizOutcome = (correct) => {
    if (!randomQuizItem) return;
    const seconds = Math.max(
      0,
      Math.round((Date.now() - quizStartedAtRef.current) / 1000)
    );
    appendQuizLog({
      kind: randomQuizItem.kind,
      correct,
      seconds,
      title: randomQuizItem.title,
      fileLabel: randomQuizItem.fileLabel,
      folderTag: randomQuizItem.folderTag,
      subject: (randomQuizItem.subject || "").trim() || undefined,
      quizSelectedSubjects,
      quizFileOnlyMode,
      secondPlanFocus: quizFileOnlyMode ? quizSecondPlanFocus || undefined : undefined,
    });
    setMessage(
      `已记录：${correct ? "对" : "错"}，用时 ${formatElapsed(seconds)}（已写入本地 smr-quiz-log）`
    );
    const pool = quizFilteredPool;
    if (pool.length <= 1) {
      setRandomQuizItem(pool[0] || randomQuizItem);
      quizStartedAtRef.current = Date.now();
      setQuizElapsedSec(0);
      return;
    }
    let next = pool[Math.floor(Math.random() * pool.length)];
    let guard = 0;
    while (next.id === randomQuizItem.id && guard++ < 12) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }
    setRandomQuizItem(next);
  };

  const toggleQuizFolder = (folder) => {
    setQuizSelectedFolders((prev) =>
      prev.includes(folder) ? prev.filter((t) => t !== folder) : [...prev, folder]
    );
  };

  const toggleQuizSubject = (subject) => {
    setQuizSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const onQuizFileOnlyChange = (checked) => {
    setQuizFileOnlyMode(checked);
    trySetLocalStorage(LS_QUIZ_FILE_ONLY, checked ? "1" : "0");
    if (
      checked &&
      !quizSecondPlanFocus &&
      secondPlanRelPaths.length > 0
    ) {
      const pick =
        secondPlanRelPaths.find((rel) =>
          /\/\d{4}-\d{2}-\d{2}\.md$/i.test(rel)
        ) || secondPlanRelPaths[0];
      setQuizSecondPlanFocus(pick);
      trySetLocalStorage(LS_SECOND_PLAN_FOCUS, pick);
    }
    setMessage(
      checked
        ? "已开启「文件内刷题」：仅当前所选二刷 .md"
        : "已关闭「文件内刷题」：按左侧来源 + 文件夹筛选随机抽题"
    );
  };

  const onQuizSecondPlanFileChange = (e) => {
    const v = e.target.value;
    setQuizSecondPlanFocus(v);
    trySetLocalStorage(LS_SECOND_PLAN_FOCUS, v);
    if (quizFileOnlyMode) {
      setMessage(v ? `文件内刷题：${v}` : "请选择某一二刷 .md");
    }
  };

  const openRandomQuiz = async () => {
    setError("");
    setMessage("");
    if (!files.length) {
      setError("请先打开文件夹（建议选 Study 根目录）");
      return;
    }
    const wrongFiles = files.filter(isWrongBookFile);
    const secondFiles = files.filter(isSecondPassPlanFile);
    if (!wrongFiles.length && !secondFiles.length) {
      setError(
        "未找到题库：需要「文件名含错题的 .md（且不在二刷计划目录）」或「路径含二刷计划的 .md」"
      );
      return;
    }
    setLoading(true);
    try {
      const blocks = [];
      for (const f of wrongFiles) {
        const txt = await readMarkdownFileText(f, mode);
        if (!txt) continue;
        const rp = normalizeRelPath(f.relativePath);
        splitWrongBookBlocks(txt).forEach((b) => blocks.push(parseWrongBlock(b, rp)));
      }
      for (const f of secondFiles) {
        const txt = await readMarkdownFileText(f, mode);
        if (!txt) continue;
        const rp = normalizeRelPath(f.relativePath);
        splitSecondPassBlocks(txt).forEach((b) =>
          blocks.push(parseSecondPassBlock(b, rp))
        );
      }
      if (!blocks.length) {
        setError(
          "题库为空：错题本需「### 题目：」/「## 题目：」条目；二刷计划需「## 题目 n：」条目"
        );
        setLoading(false);
        return;
      }
      let nid = 0;
      const withIds = blocks.map((b) => ({
        ...b,
        id: `q-${nid++}-${b.kind}-${b.fileLabel}-${b.title}`.slice(0, 260),
      }));
      const planRelPaths = secondFiles
        .map((f) => normalizeRelPath(f.relativePath))
        .sort((a, b) => b.localeCompare(a, "zh-CN"));
      let focusRel = resolveSecondPlanFocusRel(planRelPaths);
      let fileOnlyNow = false;
      try {
        fileOnlyNow = tryGetLocalStorage(LS_QUIZ_FILE_ONLY) === "1";
      } catch {
        /* ignore */
      }
      if (fileOnlyNow && !focusRel && planRelPaths.length) {
        focusRel = planRelPaths[0];
      }
      setQuizFileOnlyMode(fileOnlyNow);
      setQuizSelectedFolders([]);
      setQuizSelectedSubjects([]);
      setQuizSourceWrong(true);
      setQuizSourceSecond(true);
      setQuizSecondPlanFocus(focusRel);
      setQuizFullPool(withIds);
      const nWrong = withIds.filter((x) => x.kind === "wrongbook").length;
      const nSecond = withIds.filter((x) => x.kind === "secondpass").length;
      const initialFiltered = filterQuizPool(withIds, {
        quizSourceWrong: true,
        quizSourceSecond: true,
        quizSelectedFolders: [],
        quizSelectedSubjects: [],
        quizSecondPlanFocus: focusRel,
        quizFileOnlyMode: fileOnlyNow,
      });
      const firstPool = initialFiltered.length ? initialFiltered : withIds;
      const first = firstPool[Math.floor(Math.random() * firstPool.length)];
      setRandomQuizItem(first);
      setRandomQuizOpen(true);
      const modeHint = fileOnlyNow
        ? `；文件内刷题 · ${focusRel || "请选择 .md"}`
        : "；文件夹筛选 + 随机（关闭「文件内刷题」时）";
      setMessage(
        `已加载 ${withIds.length} 题（错题本 ${nWrong} + 二刷计划 ${nSecond}）${modeHint}`
      );
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

  const startSidebarResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let lastW = startW;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      let w = startW + dx;
      w = Math.max(200, Math.min(w, window.innerWidth * 0.72));
      lastW = w;
      setSidebarWidth(w);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      trySetLocalStorage(LS_SIDEBAR_W, String(Math.round(lastW)));
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startViewerSplitResize = (e) => {
    e.preventDefault();
    const splitEl = viewerSplitRef.current;
    if (!splitEl) return;
    let lastRatio = splitRatio;
    const onMove = (ev) => {
      const r = splitEl.getBoundingClientRect();
      if (r.width < 80) return;
      let ratio = (ev.clientX - r.left) / r.width;
      ratio = Math.max(0.18, Math.min(0.82, ratio));
      lastRatio = ratio;
      setSplitRatio(ratio);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      trySetLocalStorage(LS_SPLIT_RATIO, String(lastRatio));
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
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
        <aside className="sidebar" style={{ width: sidebarWidth, flexShrink: 0 }}>
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
                          {normalizeRelPath(file.relativePath)}
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

        <div
          className="layout-gutter layout-gutter-sidebar"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整侧栏宽度"
          onMouseDown={startSidebarResize}
        />

        <div className="layout-main">
          <main className={`viewer viewer-mode-${viewMode}`}>
            <div className="viewer-banners">
              {loading && <p className="hint">加载中...</p>}
              {error && <p className="error">{error}</p>}
              {message && <p className="success">{message}</p>}
            </div>

            {!loading && !error && !activeFile && (
              <p className="hint viewer-placeholder">请选择一个文件夹并点击左侧文件查看内容。</p>
            )}

            {!loading && !error && activeFile && viewMode === "edit" && (
              <textarea
                ref={editorRef}
                className="editor viewer-fill"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
              />
            )}

            {!loading && !error && activeFile && viewMode === "preview" && (
              <article
                className="markdown viewer-fill"
                dangerouslySetInnerHTML={{ __html: marked.parse(previewMarkdown || "") }}
              />
            )}

            {!loading && !error && activeFile && viewMode === "split" && (
              <div className="viewer-split" ref={viewerSplitRef}>
                <div
                  className="viewer-pane"
                  style={{ flex: `${splitRatio} 1 0%` }}
                >
                  <textarea
                    ref={editorRef}
                    className="editor viewer-fill"
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
                <div
                  className="layout-gutter layout-gutter-split"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="调整编辑区与预览区比例"
                  onMouseDown={startViewerSplitResize}
                />
                <div
                  className="viewer-pane"
                  style={{ flex: `${1 - splitRatio} 1 0%` }}
                >
                  <article
                    className="markdown viewer-fill"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(previewMarkdown || ""),
                    }}
                  />
                </div>
              </div>
            )}
          </main>
        </div>
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
                <span className="quiz-kind-badge">
                  {randomQuizItem.kind === "secondpass" ? "二刷计划" : "错题本"}
                </span>
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

            <div className="quiz-filters">
              <div className="quiz-mode-row">
                <label className="quiz-check quiz-fileonly-main">
                  <input
                    type="checkbox"
                    checked={quizFileOnlyMode}
                    onChange={(e) => onQuizFileOnlyChange(e.target.checked)}
                  />
                  文件内刷题（仅所选二刷 .md · 不含错题本）
                </label>
                <span className="quiz-pool-count">
                  当前池 {quizFilteredPool.length} / 全量 {quizFullPool.length} 题
                </span>
              </div>
              {quizFileOnlyMode && secondPlanRelPaths.length > 0 && (
                <div className="quiz-secondplan-row">
                  <label className="quiz-secondplan-label" htmlFor="quiz-second-md">
                    二刷 .md
                  </label>
                  <select
                    id="quiz-second-md"
                    className="quiz-secondplan-select"
                    value={quizSecondPlanFocus || secondPlanRelPaths[0]}
                    onChange={onQuizSecondPlanFileChange}
                  >
                    {secondPlanRelPaths.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                  <span className="quiz-hint quiz-secondplan-hint">
                    只从该文件中的「## 题目」抽取；路径仍记在本地以便下次打开
                  </span>
                </div>
              )}
              {!quizFileOnlyMode && (
                <>
                  <div className="quiz-source-row">
                    <span className="quiz-filter-label">来源</span>
                    <label className="quiz-check">
                      <input
                        type="checkbox"
                        checked={quizSourceWrong}
                        onChange={(e) => setQuizSourceWrong(e.target.checked)}
                      />
                      错题本
                    </label>
                    <label className="quiz-check">
                      <input
                        type="checkbox"
                        checked={quizSourceSecond}
                        onChange={(e) => setQuizSourceSecond(e.target.checked)}
                      />
                      二刷计划
                    </label>
                  </div>
                  <div className="quiz-tags-row">
                    <span className="quiz-filter-label">文件夹</span>
                    <span className="quiz-hint quiz-tags-hint">
                      与侧栏分组一致（仅第一层目录）；不选 = 不限；多选 = 命中其一即可
                    </span>
                  </div>
                  <div className="quiz-tags">
                    {quizFolderOptions.map((folder) => (
                      <button
                        key={folder}
                        type="button"
                        className={
                          quizSelectedFolders.includes(folder)
                            ? "quiz-tag quiz-tag--on"
                            : "quiz-tag"
                        }
                        onClick={() => toggleQuizFolder(folder)}
                      >
                        {folder}
                      </button>
                    ))}
                  </div>
                  <div className="quiz-tags-row">
                    <span className="quiz-filter-label">科目</span>
                    <span className="quiz-hint quiz-tags-hint">
                      对应「- 科目：」；不选 = 不限；多选 = 命中其一（「高数」亦匹配「高等数学」等）
                    </span>
                  </div>
                  <div className="quiz-tags">
                    {quizSubjectOptions.map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        className={
                          quizSelectedSubjects.includes(subj)
                            ? "quiz-tag quiz-tag--subject quiz-tag--on"
                            : "quiz-tag quiz-tag--subject"
                        }
                        onClick={() => toggleQuizSubject(subj)}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="quiz-meta">
              {randomQuizItem.kind === "wrongbook" && (
                <p>
                  <strong>首次录入日期</strong>（错题内「日期」字段）：{randomQuizItem.firstDate}
                </p>
              )}
              {randomQuizItem.source && randomQuizItem.source !== "—" && (
                <p>
                  <strong>出处</strong>：{randomQuizItem.source}
                </p>
              )}
              {randomQuizItem.kind === "secondpass" &&
                randomQuizItem.secondPassStandard && (
                  <p>
                    <strong>二刷标准</strong>：{randomQuizItem.secondPassStandard}
                  </p>
                )}
              <p>
                <strong>文件</strong>：{randomQuizItem.fileLabel}
              </p>
              <p>
                <strong>题目标题</strong>：{randomQuizItem.title}
              </p>
              {randomQuizItem.subject && (
                <p>
                  <strong>科目</strong>：{randomQuizItem.subject}
                </p>
              )}
              <p>
                <strong>文件夹</strong>：{randomQuizItem.folderTag || "—"}
              </p>
              <p className="quiz-hint">答案见纸质版；本窗口与错题本预览均不展示解析正文。</p>
            </div>
            <article
              className="markdown quiz-body"
              dangerouslySetInnerHTML={{ __html: randomQuizHtml }}
            />
            <div className="quiz-footer">
              <div className="quiz-timer">
                本题计时：<strong>{formatElapsed(quizElapsedSec)}</strong>
                <span className="quiz-hint">（换题或点对/错后自动重计）</span>
              </div>
              <div className="quiz-outcome-btns">
                <button
                  type="button"
                  className="quiz-btn-ok"
                  onClick={() => recordQuizOutcome(true)}
                >
                  做对
                </button>
                <button
                  type="button"
                  className="quiz-btn-bad"
                  onClick={() => recordQuizOutcome(false)}
                >
                  做错
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
