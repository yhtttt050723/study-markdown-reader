import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { parseMarkdownWithMath } from "./markdownRender.js";
import "./App.css";
import {
  LS_APP_SECTION,
  LS_FOLDER_PATH,
  LS_QUICK_NOTES,
  LS_QUIZ_FILE_ONLY,
  LS_QUIZ_LOG,
  LS_SECOND_PLAN_FOCUS,
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
  enumerateImageLoadCandidates,
  imagePathLookupKeys,
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
import { aggregateQuizStats, readQuizLog } from "./quizLogAnalytics.js";
import { QuizStatsDashboard } from "./QuizStatsDashboard.jsx";
import { SchoolTargetsDashboard } from "./SchoolTargetsDashboard.jsx";
import { isSchoolTargetsFile, parseSchoolTargetsMarkdown } from "./schoolTargets.js";
import { PlanBoardDashboard } from "./PlanBoardDashboard.jsx";
import {
  checklistBoardTitle,
  isChecklistBoardFile,
  isPlanBoardFile,
  isStatusBoardFile,
  parsePlanBoardMarkdown,
  togglePlanBoardItem,
} from "./planBoard.js";
import {
  buildStudyProgressMarkdown,
  DEFAULT_STUDY_PROGRESS,
  isStudyProgressFile,
  mergeStudyProgressData,
  parseStudyProgressFromMarkdown,
  readStudyProgress,
  resolveStudyProgressDefaultPath,
  writeStudyProgress,
} from "./studyProgress.js";
import {
  buildVideoProgressMarkdown,
  DEFAULT_VIDEO_PROGRESS,
  isVideoProgressFile,
  mergeVideoProgressData,
  parseVideoProgressFromMarkdown,
  readVideoProgress,
  resolveVideoProgressDefaultPath,
  writeVideoProgress,
} from "./videoProgress.js";
import {
  findSubjectCatalogFile,
  parse408Catalog,
  parseMathCatalog,
  parseZhangYu1000Catalog,
} from "./studyCatalog.js";
import {
  isPlanPathSourceFile,
  parsePlanPathFromMarkdown,
  readPlanPathDone,
  writePlanPathDone,
} from "./studyPlanPath.js";
import { computeOverallProgressScore } from "./progressScore.js";
import {
  computeRollingSevenDayDelta,
  countDailyReportsInRange,
  dayOverDayDeltas,
  readProgressSnapshots,
  upsertTodaySnapshot,
} from "./progressSnapshots.js";
import { StudyPathDashboard } from "./StudyPathDashboard.jsx";
import { StudyProgressDashboard } from "./StudyProgressDashboard.jsx";
import { VideoProgressDashboard } from "./VideoProgressDashboard.jsx";
import { WeeklyProgressDashboard } from "./WeeklyProgressDashboard.jsx";
import { StudyTimeCalendarDashboard } from "./StudyTimeCalendarDashboard.jsx";
import {
  listDailyReportFiles,
  loadStudyTimeByDate,
  localYmd as studyLocalYmd,
} from "./studyDailyTime.js";
import {
  addPendingThreeHourBlock,
  buildPendingStudyTimeMarkdown,
  formatPendingCopyForAgent,
  getPendingBlocksForDate,
  mergeStudyTimeDisplay,
  parsePendingStudyTimeMarkdown,
  readPendingStudyLog,
  removePendingBlock,
  resolvePendingStudyTimeFilePath,
  writePendingStudyLog,
} from "./studyTimeQuickLog.js";
import { FinanceDashboard } from "./FinanceDashboard.jsx";
import { readFinanceState, writeFinanceState } from "./finance.js";
import { resolveDailyMemorize } from "./resolveDailyMemorize.js";
import { readQuickNotesState } from "./quickNotes.js";
import { pickLatestSecondPassPlan } from "./secondPassPick.js";
import { HomeHub } from "./HomeHub.jsx";
import { NotesWorkspace } from "./NotesWorkspace.jsx";
import { ProgressHub } from "./ProgressHub.jsx";

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

const APP_SECTIONS = new Set(["home", "reader", "notes", "progress"]);

function readInitialAppSection() {
  const v = tryGetLocalStorage(LS_APP_SECTION);
  if (v && APP_SECTIONS.has(v)) return v;
  return "home";
}

function App() {
  const [folderPath, setFolderPath] = useState(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      return tryGetLocalStorage(LS_FOLDER_PATH)?.trim() || "";
    }
    return "";
  });
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
  const [quizStatsOpen, setQuizStatsOpen] = useState(false);
  const [studyProgressOpen, setStudyProgressOpen] = useState(false);
  const [studyProgress, setStudyProgress] = useState(() => readStudyProgress());
  const [videoProgressOpen, setVideoProgressOpen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(() => readVideoProgress());
  const [mathCatalogRaw, setMathCatalogRaw] = useState("");
  const [catalog408Raw, setCatalog408Raw] = useState("");
  const [planPathRaw, setPlanPathRaw] = useState("");
  const [planPathDone, setPlanPathDone] = useState(() => readPlanPathDone());
  const [studyPathOpen, setStudyPathOpen] = useState(false);
  const [weeklyProgressOpen, setWeeklyProgressOpen] = useState(false);
  const [studyTimeOpen, setStudyTimeOpen] = useState(false);
  const [studyTimeYear, setStudyTimeYear] = useState(() => new Date().getFullYear());
  const [studyTimeMonth, setStudyTimeMonth] = useState(() => new Date().getMonth() + 1);
  const [studyTimeByDate, setStudyTimeByDate] = useState({});
  const [studyTimeLoading, setStudyTimeLoading] = useState(false);
  const [studyTimeError, setStudyTimeError] = useState("");
  const [studyTimeSelected, setStudyTimeSelected] = useState(() => studyLocalYmd());
  const [studyTimeTick, setStudyTimeTick] = useState(0);
  const [studyTimePendingTick, setStudyTimePendingTick] = useState(0);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [schoolTargetsOpen, setSchoolTargetsOpen] = useState(false);
  const [schoolTargetsModalData, setSchoolTargetsModalData] = useState(null);
  const [schoolTargetsModalError, setSchoolTargetsModalError] = useState(null);
  const [checklistOverlayOpen, setChecklistOverlayOpen] = useState(false);
  const [checklistOverlayData, setChecklistOverlayData] = useState(null);
  const [checklistOverlayError, setChecklistOverlayError] = useState(null);
  const [checklistOverlayFile, setChecklistOverlayFile] = useState(null);
  const [checklistOverlayTitle, setChecklistOverlayTitle] = useState("进度规划看板");
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [dailyMemorizeRaw, setDailyMemorizeRaw] = useState("");
  const [dailyMemorizeErr, setDailyMemorizeErr] = useState("");
  const [dailyMemorizeLoading, setDailyMemorizeLoading] = useState(false);
  const [dailyMemorizeMeta, setDailyMemorizeMeta] = useState({
    mode: "empty",
    sourceLabel: "",
    ymd: "",
  });
  const [secondPassRaw, setSecondPassRaw] = useState("");
  const [secondPassErr, setSecondPassErr] = useState("");
  const [secondPassLoading, setSecondPassLoading] = useState(false);
  const [financeState, setFinanceState] = useState(() => readFinanceState());
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [quizLogVersion, setQuizLogVersion] = useState(0);
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
  const progressWriteTimerRef = useRef(null);
  const videoProgressWriteTimerRef = useRef(null);
  const webInputRef = useRef(null);
  const editorRef = useRef(null);
  const viewerSplitRef = useRef(null);

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredNumber(LS_SIDEBAR_W, 320, 200, 720)
  );
  const [splitRatio, setSplitRatio] = useState(() =>
    readStoredNumber(LS_SPLIT_RATIO, 0.5, 0.18, 0.82)
  );

  const [appSection, setAppSection] = useState(readInitialAppSection);

  const hasApi = useMemo(() => Boolean(window.electronAPI), []);
  const canNativeSave = useMemo(
    () =>
      Boolean(
        window.electronAPI &&
          typeof window.electronAPI.writeMarkdownFile === "function"
      ),
    []
  );

  const openFile = useCallback(async (file) => {
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
  }, []);

  /** Electron：打开文件夹并可选持久化路径（浏览器不设默认文件夹） */
  const loadElectronFolder = useCallback(
    async (pickedPath, { persist = true, openFirst = true } = {}) => {
      if (!window.electronAPI?.listMarkdownFiles) return false;
      setMode("electron");
      setFolderPath(pickedPath);
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const markdownFiles = await window.electronAPI.listMarkdownFiles(pickedPath);
        setFiles(markdownFiles);
        if (persist) trySetLocalStorage(LS_FOLDER_PATH, pickedPath);
        setExpandedGroups(buildExpandedGroupsSeed(markdownFiles));
        if (markdownFiles.length > 0 && openFirst) {
          await openFile(markdownFiles[0]);
        } else {
          setActiveFile(null);
          setContent("");
        }
        return true;
      } catch (err) {
        setError(err.message || "读取文件夹失败");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [openFile]
  );

  /** 桌面版启动：恢复上次文件夹；若无则探测默认 Study（浏览器 / 云端不设默认） */
  useEffect(() => {
    if (!hasApi) return;
    let cancelled = false;
    (async () => {
      const saved = tryGetLocalStorage(LS_FOLDER_PATH)?.trim();
      if (saved) {
        const ok = await loadElectronFolder(saved, { persist: true });
        if (!cancelled && ok) return;
        if (!ok) trySetLocalStorage(LS_FOLDER_PATH, "");
      }
      if (cancelled) return;
      const api = window.electronAPI;
      if (typeof api?.defaultStudyFolder !== "function") return;
      const def = await api.defaultStudyFolder();
      if (cancelled || !def) return;
      await loadElectronFolder(def, { persist: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [hasApi, loadElectronFolder]);

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

  const [dailyMemorizeOpenFile, setDailyMemorizeOpenFile] = useState(null);
  const [quickNotesTick, setQuickNotesTick] = useState(0);

  useEffect(() => {
    const bump = () => setQuickNotesTick((t) => t + 1);
    window.addEventListener("smr-quick-notes-changed", bump);
    const onStorage = (e) => {
      if (e.key === LS_QUICK_NOTES) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("smr-quick-notes-changed", bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const openDailyMemorizeInReader = useCallback(() => {
    if (!dailyMemorizeOpenFile) return;
    if (dirty && activeFile) {
      if (
        !window.confirm(
          "当前有未保存修改，确定打开「每日要背」来源文件？（可先保存再打开）"
        )
      ) {
        return;
      }
    }
    setAppSection("reader");
    void openFile(dailyMemorizeOpenFile);
  }, [dailyMemorizeOpenFile, openFile, dirty, activeFile]);

  useEffect(() => {
    let cancelled = false;
    setDailyMemorizeLoading(true);
    setDailyMemorizeErr("");
    (async () => {
      try {
        const result = await resolveDailyMemorize({
          files,
          readFile: (f) => readMarkdownFileText(f, mode),
          quickNotes: readQuickNotesState().notes,
        });
        if (!cancelled) {
          setDailyMemorizeRaw(result.markdown || "");
          setDailyMemorizeMeta({
            mode: result.mode,
            sourceLabel: result.sourceLabel || "",
            ymd: result.ymd || "",
          });
          setDailyMemorizeOpenFile(result.openFile || null);
        }
      } catch (e) {
        if (!cancelled) {
          setDailyMemorizeErr(e?.message || "读取失败");
          setDailyMemorizeRaw("");
          setDailyMemorizeMeta({ mode: "empty", sourceLabel: "", ymd: "" });
          setDailyMemorizeOpenFile(null);
        }
      } finally {
        if (!cancelled) setDailyMemorizeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, mode, quickNotesTick]);

  const dailySecondPassFile = useMemo(
    () => pickLatestSecondPassPlan(files),
    [files]
  );

  const openDailySecondPassInReader = useCallback(() => {
    if (!dailySecondPassFile) return;
    if (dirty && activeFile) {
      if (
        !window.confirm(
          "当前有未保存修改，确定打开「每日二刷」对应文件？（可先保存再打开）"
        )
      ) {
        return;
      }
    }
    setAppSection("reader");
    void openFile(dailySecondPassFile);
  }, [dailySecondPassFile, openFile, dirty, activeFile]);

  useEffect(() => {
    if (!dailySecondPassFile) {
      setSecondPassRaw("");
      setSecondPassErr("");
      setSecondPassLoading(false);
      return;
    }
    let cancelled = false;
    setSecondPassLoading(true);
    setSecondPassErr("");
    (async () => {
      try {
        const t = await readMarkdownFileText(dailySecondPassFile, mode);
        if (!cancelled) {
          setSecondPassRaw(typeof t === "string" ? t : "");
        }
      } catch (e) {
        if (!cancelled) {
          setSecondPassErr(e?.message || "读取失败");
          setSecondPassRaw("");
        }
      } finally {
        if (!cancelled) setSecondPassLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dailySecondPassFile, mode]);

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

  const studyProgressFileEntry = useMemo(
    () => files.find((f) => isStudyProgressFile(f)) ?? null,
    [files]
  );

  const videoProgressFileEntry = useMemo(
    () => files.find((f) => isVideoProgressFile(f)) ?? null,
    [files]
  );

  const mathCatalog = useMemo(() => parseMathCatalog(mathCatalogRaw), [mathCatalogRaw]);
  const zhangyu1000Catalog = useMemo(
    () => parseZhangYu1000Catalog(mathCatalogRaw),
    [mathCatalogRaw]
  );
  const catalog408 = useMemo(() => parse408Catalog(catalog408Raw), [catalog408Raw]);
  const planPathNodes = useMemo(
    () => parsePlanPathFromMarkdown(planPathRaw),
    [planPathRaw]
  );

  const videoProgressSourceHint = useMemo(() => {
    if (videoProgressFileEntry) {
      return `数据来自「${normalizeRelPath(videoProgressFileEntry.relativePath)}」内的 smr-video-progress 代码块；同时写入 localStorage（smr-video-progress-board）。`;
    }
    if (hasApi && folderPath) {
      return `当前未见「视频进度看板数据」文件；在看板内修改后会写入「学习资料/学习视频进度/视频进度看板数据.md」。`;
    }
    return `未打开本地文件夹时仅使用浏览器 localStorage（smr-video-progress-board）。`;
  }, [videoProgressFileEntry, hasApi, folderPath]);

  const progressSourceHint = useMemo(() => {
    if (studyProgressFileEntry) {
      return `数据来自「${normalizeRelPath(studyProgressFileEntry.relativePath)}」内的 smr-progress 代码块；同时写入 localStorage 作备份。`;
    }
    if (hasApi && folderPath) {
      return `当前未见「学习进度」文件；在下方调整后会写入「周期记录/学习进度.md」（首次自动创建），并同步 localStorage。`;
    }
    return `未打开本地文件夹时仅使用浏览器 localStorage（smr-study-progress）。`;
  }, [studyProgressFileEntry, hasApi, folderPath]);

  const currentOverallScore = useMemo(
    () => computeOverallProgressScore(studyProgress, mathCatalog, catalog408),
    [studyProgress, mathCatalog, catalog408]
  );

  const weeklyProgressStats = useMemo(() => {
    const snaps = readProgressSnapshots();
    const roll = computeRollingSevenDayDelta(snaps);
    const dayRows = dayOverDayDeltas(snaps, roll.startStr, roll.endStr);
    const dailyReportDays = countDailyReportsInRange(files, roll.startStr, roll.endStr);
    return {
      ...roll,
      dayRows,
      dailyReportDays,
      currentScore: currentOverallScore,
    };
  }, [snapshotTick, studyProgress, mathCatalog, catalog408, files, currentOverallScore]);

  const openWeeklyProgress = useCallback(() => {
    upsertTodaySnapshot(
      computeOverallProgressScore(studyProgress, mathCatalog, catalog408)
    );
    setSnapshotTick((t) => t + 1);
    setWeeklyProgressOpen(true);
  }, [studyProgress, mathCatalog, catalog408]);

  const dailyReportFiles = useMemo(() => listDailyReportFiles(files), [files]);

  const reloadStudyTimeCalendar = useCallback(async () => {
    if (!folderPath) {
      setStudyTimeError("请先在 Markdown 浏览器中打开 Study 根文件夹。");
      setStudyTimeByDate({});
      return;
    }
    setStudyTimeLoading(true);
    setStudyTimeError("");
    const mo = String(studyTimeMonth).padStart(2, "0");
    const lastDay = new Date(studyTimeYear, studyTimeMonth, 0).getDate();
    const startStr = `${studyTimeYear}-${mo}-01`;
    const endStr = `${studyTimeYear}-${mo}-${String(lastDay).padStart(2, "0")}`;
    const readText = async (fp) => {
      if (typeof window.electronAPI?.readMarkdownFile === "function") {
        return window.electronAPI.readMarkdownFile(fp);
      }
      const ent = files.find((f) => f.fullPath === fp);
      if (ent?.fileObject) {
        return new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result ?? ""));
          r.onerror = () => reject(new Error("read failed"));
          r.readAsText(ent.fileObject);
        });
      }
      throw new Error("无法读取文件");
    };
    try {
      const map = await loadStudyTimeByDate(dailyReportFiles, startStr, endStr, readText);
      let pendingLog = readPendingStudyLog();
      const pendingPath = resolvePendingStudyTimeFilePath(folderPath);
      if (pendingPath && typeof window.electronAPI?.readMarkdownFile === "function") {
        try {
          const pmd = await window.electronAPI.readMarkdownFile(pendingPath);
          pendingLog = parsePendingStudyTimeMarkdown(pmd);
          writePendingStudyLog(pendingLog);
        } catch {
          /* 无待同步文件时沿用 localStorage */
        }
      }
      /** @type {typeof map} */
      const enriched = {};
      for (const [ymd, data] of Object.entries(map)) {
        enriched[ymd] = mergeStudyTimeDisplay(
          data,
          getPendingBlocksForDate(pendingLog, ymd)
        );
      }
      for (const ymd of Object.keys(pendingLog.days || {})) {
        if (!enriched[ymd]) {
          enriched[ymd] = mergeStudyTimeDisplay(
            { totalMinutes: 0, blocks: [], source: "none" },
            getPendingBlocksForDate(pendingLog, ymd)
          );
        }
      }
      setStudyTimeByDate(enriched);
    } catch (err) {
      setStudyTimeError(err.message || "读取日报失败");
      setStudyTimeByDate({});
    } finally {
      setStudyTimeLoading(false);
    }
  }, [folderPath, studyTimeYear, studyTimeMonth, dailyReportFiles, files, studyTimePendingTick]);

  const persistPendingStudyTime = useCallback(
    async (log) => {
      writePendingStudyLog(log);
      setStudyTimePendingTick((t) => t + 1);
      if (
        canNativeSave &&
        folderPath &&
        typeof window.electronAPI?.writeMarkdownFile === "function"
      ) {
        const targetPath = resolvePendingStudyTimeFilePath(folderPath);
        if (targetPath) {
          try {
            await window.electronAPI.writeMarkdownFile(
              targetPath,
              buildPendingStudyTimeMarkdown(log)
            );
          } catch {
            /* 仅 localStorage 亦可 */
          }
        }
      }
    },
    [canNativeSave, folderPath]
  );

  const handleAddQuickThreeHour = useCallback(
    async (ymd, label) => {
      const next = addPendingThreeHourBlock(ymd, { label });
      await persistPendingStudyTime(next);
      setStudyTimeTick((t) => t + 1);
    },
    [persistPendingStudyTime]
  );

  const handleRemovePendingBlock = useCallback(
    async (ymd, slotKey) => {
      const next = removePendingBlock(ymd, slotKey);
      await persistPendingStudyTime(next);
      setStudyTimeTick((t) => t + 1);
    },
    [persistPendingStudyTime]
  );

  const handleCopyPendingForAgent = useCallback((ymd) => {
    const log = readPendingStudyLog();
    return formatPendingCopyForAgent(ymd, getPendingBlocksForDate(log, ymd));
  }, [studyTimePendingTick]);

  const openStudyTimeCalendar = useCallback(() => {
    const today = studyLocalYmd();
    const [y, m] = today.split("-").map(Number);
    setStudyTimeYear(y);
    setStudyTimeMonth(m);
    setStudyTimeSelected(today);
    setStudyTimeOpen(true);
  }, []);

  useEffect(() => {
    if (!studyTimeOpen) return;
    reloadStudyTimeCalendar();
  }, [studyTimeOpen, studyTimeYear, studyTimeMonth, studyTimeTick, reloadStudyTimeCalendar]);

  const goReaderHome = useCallback(() => {
    if (dirty && activeFile) {
      if (
        !window.confirm("当前有未保存修改，确定返回首页？（可先点「保存」再返回）")
      ) {
        return;
      }
    }
    setAppSection("home");
  }, [dirty, activeFile]);

  const selectAppSection = useCallback((section) => {
    if (APP_SECTIONS.has(section)) setAppSection(section);
  }, []);

  const progressCatalogHint = useMemo(() => {
    const parts = [];
    if (files.length === 0) return null;
    if (!mathCatalogRaw)
      parts.push(
        "未读取到 Math.mdc：数学进度按内置章数估算（请放在「学习资料/MDC归档/科目目录」等路径下）。"
      );
    if (!catalog408Raw)
      parts.push("未读取到 408.mdc：408 进度按内置章数估算（建议学习资料/MDC归档/科目目录/408.mdc）。");
    return parts.length ? parts.join(" ") : null;
  }, [mathCatalogRaw, catalog408Raw, files.length]);

  const persistStudyProgress = useCallback(
    (next) => {
      const merged = mergeStudyProgressData(
        structuredClone(DEFAULT_STUDY_PROGRESS),
        next,
        { math: mathCatalog, cs408: catalog408, zhangyu1000: zhangyu1000Catalog }
      );
      setStudyProgress(merged);
      writeStudyProgress(merged);
      upsertTodaySnapshot(computeOverallProgressScore(merged, mathCatalog, catalog408));
      setSnapshotTick((t) => t + 1);
      if (!canNativeSave || !folderPath) return;
      const targetPath =
        studyProgressFileEntry?.fullPath ?? resolveStudyProgressDefaultPath(folderPath);
      if (!targetPath) return;
      const hadFileInTree = Boolean(studyProgressFileEntry);
      window.clearTimeout(progressWriteTimerRef.current);
      progressWriteTimerRef.current = window.setTimeout(async () => {
        try {
          await window.electronAPI.writeMarkdownFile(
            targetPath,
            buildStudyProgressMarkdown(merged)
          );
          if (!hadFileInTree && folderPath && window.electronAPI?.listMarkdownFiles) {
            const markdownFiles = await window.electronAPI.listMarkdownFiles(folderPath);
            setFiles(markdownFiles);
          }
        } catch (err) {
          setError(err.message || "学习进度.md 写入失败");
        }
      }, 400);
    },
    [canNativeSave, folderPath, studyProgressFileEntry, mathCatalog, catalog408, zhangyu1000Catalog]
  );

  const persistVideoProgress = useCallback(
    (next) => {
      const merged = mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), next);
      setVideoProgress(merged);
      writeVideoProgress(merged);
      if (!canNativeSave || !folderPath) return;
      const targetPath =
        videoProgressFileEntry?.fullPath ?? resolveVideoProgressDefaultPath(folderPath);
      if (!targetPath) return;
      const hadFileInTree = Boolean(videoProgressFileEntry);
      window.clearTimeout(videoProgressWriteTimerRef.current);
      videoProgressWriteTimerRef.current = window.setTimeout(async () => {
        try {
          await window.electronAPI.writeMarkdownFile(
            targetPath,
            buildVideoProgressMarkdown(merged)
          );
          if (!hadFileInTree && folderPath && window.electronAPI?.listMarkdownFiles) {
            const markdownFiles = await window.electronAPI.listMarkdownFiles(folderPath);
            setFiles(markdownFiles);
          }
        } catch (err) {
          setError(err.message || "视频进度看板数据.md 写入失败");
        }
      }, 400);
    },
    [canNativeSave, folderPath, videoProgressFileEntry]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mf = findSubjectCatalogFile(files, "Math.mdc");
      const f408 = findSubjectCatalogFile(files, "408.mdc");
      const planFile = files.find((f) => isPlanPathSourceFile(f)) ?? null;
      let math = "";
      let c408 = "";
      let planMd = "";
      if (mf) {
        try {
          math = await readMarkdownFileText(mf, mode);
        } catch {
          math = "";
        }
      }
      if (f408) {
        try {
          c408 = await readMarkdownFileText(f408, mode);
        } catch {
          c408 = "";
        }
      }
      if (planFile) {
        try {
          planMd = await readMarkdownFileText(planFile, mode);
        } catch {
          planMd = "";
        }
      }
      if (!cancelled) {
        setMathCatalogRaw(math);
        setCatalog408Raw(c408);
        setPlanPathRaw(planMd);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, mode]);

  useEffect(() => {
    setStudyProgress((prev) =>
      mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), prev, {
        math: mathCatalog,
        cs408: catalog408,
        zhangyu1000: zhangyu1000Catalog,
      })
    );
  }, [mathCatalog, catalog408, zhangyu1000Catalog]);

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
          /- 题目图片[:：]\s*([^\n]+(?:\.png|\.jpg|\.jpeg|\.webp|\.gif))/gi
        )
      );
      const imagePaths = [...new Set(matches.map((m) => m[1].trim()))];
      if (!imagePaths.length || !window.electronAPI?.readLocalImageAsDataUrl) {
        setImageDataMap({});
        return;
      }
      const partialMaps = await Promise.all(
        imagePaths.map(async (p) => {
          const candidates = enumerateImageLoadCandidates(p, folderPath);
          let dataUrl = null;
          for (const cand of candidates) {
            const normalized = cand.replace(/\//g, "\\");
            const u = await window.electronAPI.readLocalImageAsDataUrl(normalized);
            if (u) {
              dataUrl = u;
              break;
            }
          }
          if (!dataUrl) return {};
          const keys = imagePathLookupKeys(p);
          return Object.fromEntries(keys.map((k) => [k, dataUrl]));
        })
      );
      setImageDataMap(Object.assign({}, ...partialMaps));
    };
    loadImages();
  }, [content, folderPath]);

  useEffect(() => {
    const path = randomQuizItem?.imagePath;
    if (!path || !window.electronAPI?.readLocalImageAsDataUrl) {
      setRandomQuizImageData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const candidates = enumerateImageLoadCandidates(path, folderPath);
      let dataUrl = null;
      for (const cand of candidates) {
        const normalized = cand.replace(/\//g, "\\");
        dataUrl = await window.electronAPI.readLocalImageAsDataUrl(normalized);
        if (dataUrl) break;
      }
      if (!cancelled) setRandomQuizImageData(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [randomQuizItem, folderPath]);

  useEffect(() => {
    writeFinanceState(financeState);
  }, [financeState]);

  useEffect(() => {
    trySetLocalStorage(LS_APP_SECTION, appSection);
  }, [appSection]);

  /** Electron：刷题日志写入 userData/smr-quiz-log.json；启动时从磁盘恢复到 localStorage（避免仅依赖 localStorage 重启丢失） */
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.readQuizLogFile || !api?.writeQuizLogFile) return;
    let cancelled = false;
    (async () => {
      try {
        const fromDisk = await api.readQuizLogFile();
        if (cancelled) return;

        let localArr = [];
        try {
          const rawLocal = tryGetLocalStorage(LS_QUIZ_LOG);
          localArr = rawLocal ? JSON.parse(rawLocal) : [];
          if (!Array.isArray(localArr)) localArr = [];
        } catch {
          localArr = [];
        }

        const diskArr = Array.isArray(fromDisk) ? fromDisk : [];

        if (diskArr.length === 0 && localArr.length > 0) {
          const trimmed = localArr.slice(-500);
          const payload = JSON.stringify(trimmed);
          trySetLocalStorage(LS_QUIZ_LOG, payload);
          await api.writeQuizLogFile(payload);
          setQuizLogVersion((v) => v + 1);
          return;
        }

        if (diskArr.length > 0) {
          const trimmed = diskArr.slice(-500);
          const nextJson = JSON.stringify(trimmed);
          const prevJson = tryGetLocalStorage(LS_QUIZ_LOG);
          trySetLocalStorage(LS_QUIZ_LOG, nextJson);
          if (prevJson !== nextJson) {
            setQuizLogVersion((v) => v + 1);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !weeklyProgressOpen &&
      !studyTimeOpen &&
      !studyPathOpen &&
      !studyProgressOpen &&
      !videoProgressOpen &&
      !randomQuizOpen &&
      !quizStatsOpen &&
      !financeOpen &&
      !schoolTargetsOpen &&
      !checklistOverlayOpen
    )
      return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (financeOpen) {
        setFinanceOpen(false);
        return;
      }
      if (studyTimeOpen) {
        setStudyTimeOpen(false);
        return;
      }
      if (weeklyProgressOpen) {
        setWeeklyProgressOpen(false);
        return;
      }
      if (studyPathOpen) {
        setStudyPathOpen(false);
        return;
      }
      if (videoProgressOpen) {
        setVideoProgressOpen(false);
        return;
      }
      if (studyProgressOpen) {
        setStudyProgressOpen(false);
        return;
      }
      if (quizStatsOpen) {
        setQuizStatsOpen(false);
        return;
      }
      if (schoolTargetsOpen) {
        setSchoolTargetsOpen(false);
        return;
      }
      if (checklistOverlayOpen) {
        setChecklistOverlayOpen(false);
        return;
      }
      if (randomQuizOpen) setRandomQuizOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    weeklyProgressOpen,
    studyTimeOpen,
    studyPathOpen,
    studyProgressOpen,
    videoProgressOpen,
    randomQuizOpen,
    quizStatsOpen,
    financeOpen,
    schoolTargetsOpen,
    checklistOverlayOpen,
  ]);

  useEffect(() => {
    const fp = studyProgressFileEntry?.fullPath;
    if (!fp || typeof window.electronAPI?.readMarkdownFile !== "function") return;
    let cancelled = false;
    (async () => {
      try {
        const md = await window.electronAPI.readMarkdownFile(fp);
        if (cancelled) return;
        const next = parseStudyProgressFromMarkdown(md, {
          math: mathCatalog,
          cs408: catalog408,
        });
        setStudyProgress(next);
        writeStudyProgress(next);
        upsertTodaySnapshot(computeOverallProgressScore(next, mathCatalog, catalog408));
        setSnapshotTick((t) => t + 1);
      } catch {
        /* 保留当前内存状态 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyProgressFileEntry?.fullPath, mathCatalog, catalog408]);

  useEffect(() => {
    const fp = videoProgressFileEntry?.fullPath;
    if (!fp || typeof window.electronAPI?.readMarkdownFile !== "function") return;
    let cancelled = false;
    (async () => {
      try {
        const md = await window.electronAPI.readMarkdownFile(fp);
        if (cancelled) return;
        const next = parseVideoProgressFromMarkdown(md);
        const merged = mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), next);
        setVideoProgress(merged);
        writeVideoProgress(merged);
      } catch {
        /* 保留当前内存状态 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoProgressFileEntry?.fullPath]);

  useEffect(() => {
    if (!studyProgressOpen) return;
    const fp = studyProgressFileEntry?.fullPath;
    if (fp && typeof window.electronAPI?.readMarkdownFile === "function") {
      let cancelled = false;
      (async () => {
        try {
          const md = await window.electronAPI.readMarkdownFile(fp);
          if (cancelled) return;
          const next = parseStudyProgressFromMarkdown(md, {
            math: mathCatalog,
            cs408: catalog408,
            zhangyu1000: zhangyu1000Catalog,
          });
          setStudyProgress(next);
          writeStudyProgress(next);
          upsertTodaySnapshot(computeOverallProgressScore(next, mathCatalog, catalog408));
          setSnapshotTick((t) => t + 1);
        } catch {
          if (!cancelled) {
            const merged = mergeStudyProgressData(
              structuredClone(DEFAULT_STUDY_PROGRESS),
              readStudyProgress(),
              { math: mathCatalog, cs408: catalog408, zhangyu1000: zhangyu1000Catalog }
            );
            setStudyProgress(merged);
            upsertTodaySnapshot(computeOverallProgressScore(merged, mathCatalog, catalog408));
            setSnapshotTick((t) => t + 1);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    const merged = mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), readStudyProgress(), {
      math: mathCatalog,
      cs408: catalog408,
      zhangyu1000: zhangyu1000Catalog,
    });
    setStudyProgress(merged);
    upsertTodaySnapshot(computeOverallProgressScore(merged, mathCatalog, catalog408));
    setSnapshotTick((t) => t + 1);
    return undefined;
  }, [studyProgressOpen, studyProgressFileEntry?.fullPath, mathCatalog, catalog408, zhangyu1000Catalog]);

  useEffect(() => {
    if (!videoProgressOpen) return;
    const fp = videoProgressFileEntry?.fullPath;
    if (fp && typeof window.electronAPI?.readMarkdownFile === "function") {
      let cancelled = false;
      (async () => {
        try {
          const md = await window.electronAPI.readMarkdownFile(fp);
          if (cancelled) return;
          const next = parseVideoProgressFromMarkdown(md);
          const merged = mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), next);
          setVideoProgress(merged);
          writeVideoProgress(merged);
        } catch {
          if (!cancelled) {
            const merged = mergeVideoProgressData(
              structuredClone(DEFAULT_VIDEO_PROGRESS),
              readVideoProgress()
            );
            setVideoProgress(merged);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    const merged = mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), readVideoProgress());
    setVideoProgress(merged);
    return undefined;
  }, [videoProgressOpen, videoProgressFileEntry?.fullPath]);

  const quizStatsData = useMemo(() => {
    if (!quizStatsOpen) return null;
    return aggregateQuizStats(readQuizLog());
  }, [quizStatsOpen, quizLogVersion]);

  const previewMarkdown = useMemo(() => {
    let raw = content || "";
    if (activeFile?.name?.includes("错题")) {
      raw = stripAnswerSectionsForPractice(raw);
    }
    return injectLocalQuestionImages(raw, imageDataMap, {
      useSmrImgProtocol: hasApi,
    });
  }, [content, activeFile, imageDataMap, hasApi]);

  const dailyMemorizeHtml = useMemo(() => {
    if (!dailyMemorizeRaw.trim()) return "";
    const raw = injectLocalQuestionImages(dailyMemorizeRaw, {}, {
      useSmrImgProtocol: hasApi,
    });
    return parseMarkdownWithMath(marked, raw);
  }, [dailyMemorizeRaw, hasApi]);

  const homeDailyMemorize = useMemo(
    () => ({
      html: dailyMemorizeHtml,
      relativePath: dailyMemorizeMeta.sourceLabel || "",
      loading: dailyMemorizeLoading,
      error: dailyMemorizeErr,
      hasContent: Boolean(dailyMemorizeRaw.trim()),
      canOpenInReader: Boolean(dailyMemorizeOpenFile),
      mode: dailyMemorizeMeta.mode,
      ymd: dailyMemorizeMeta.ymd,
    }),
    [
      dailyMemorizeHtml,
      dailyMemorizeMeta,
      dailyMemorizeLoading,
      dailyMemorizeErr,
      dailyMemorizeRaw,
      dailyMemorizeOpenFile,
    ]
  );

  const dailySecondPassHtml = useMemo(() => {
    if (!secondPassRaw.trim()) return "";
    const raw = injectLocalQuestionImages(secondPassRaw, {}, {
      useSmrImgProtocol: hasApi,
    });
    return parseMarkdownWithMath(marked, raw);
  }, [secondPassRaw, hasApi]);

  const homeDailySecondPass = useMemo(
    () => ({
      html: dailySecondPassHtml,
      relativePath: dailySecondPassFile
        ? normalizeRelPath(dailySecondPassFile.relativePath)
        : "",
      loading: secondPassLoading,
      error: secondPassErr,
      hasFile: Boolean(dailySecondPassFile),
    }),
    [
      dailySecondPassHtml,
      dailySecondPassFile,
      secondPassLoading,
      secondPassErr,
    ]
  );

  const schoolTargetsData = useMemo(() => {
    if (!activeFile || !isSchoolTargetsFile(activeFile)) return null;
    return parseSchoolTargetsMarkdown(content);
  }, [activeFile, content]);

  const showSchoolTargetsDash = Boolean(schoolTargetsData?.groups?.length);

  const checklistBoardData = useMemo(() => {
    if (!activeFile || !isChecklistBoardFile(activeFile)) return null;
    return parsePlanBoardMarkdown(content);
  }, [activeFile, content]);

  const showChecklistBoardDash = Boolean(checklistBoardData?.sections?.length);
  const activeChecklistBoardTitle = activeFile
    ? checklistBoardTitle(activeFile)
    : "勾选看板";

  const randomQuizHtml = useMemo(() => {
    if (!randomQuizItem) return "";
    const map =
      randomQuizImageData && randomQuizItem.imagePath
        ? { [randomQuizItem.imagePath]: randomQuizImageData }
        : {};
    const raw = injectLocalQuestionImages(randomQuizItem.bodyForQuiz || "", map, {
      useSmrImgProtocol: hasApi,
    });
    return parseMarkdownWithMath(marked, raw);
  }, [randomQuizItem, randomQuizImageData, hasApi]);

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

    setError("");
    setMessage("");
    const pickedPath = await window.electronAPI.pickDirectory();
    if (!pickedPath) {
      return;
    }

    await loadElectronFolder(pickedPath, { persist: true });
  };

  const openSchoolTargetsFromHub = useCallback(async () => {
    setError("");
    setMessage("");
    const entry = files.find((f) => isSchoolTargetsFile(f));
    if (!entry) {
      setSchoolTargetsModalError(
        "未找到「择校目标」Markdown：请先在「Markdown 浏览器」打开 Study 根目录（桌面版启动会自动尝试打开默认 Study），并确认存在文件名或路径含「择校目标」的 .md。"
      );
      setSchoolTargetsModalData(null);
      setSchoolTargetsOpen(true);
      return;
    }
    setLoading(true);
    try {
      const md = await readMarkdownFileText(entry, mode);
      const data = parseSchoolTargetsMarkdown(md);
      if (!data.groups?.length) {
        setSchoolTargetsModalError("文件中未解析到 ## 11408 或 ## 22408 章节下的表格。");
        setSchoolTargetsModalData(null);
      } else {
        setSchoolTargetsModalError(null);
        setSchoolTargetsModalData(data);
      }
      setSchoolTargetsOpen(true);
    } catch (e) {
      setSchoolTargetsModalError(String(e.message || e));
      setSchoolTargetsModalData(null);
      setSchoolTargetsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [files, mode]);

  const openChecklistBoardFromHub = useCallback(
    async (matcher, title, notFoundMsg) => {
      setError("");
      setMessage("");
      const entry = files.find((f) => matcher(f));
      if (!entry) {
        setChecklistOverlayError(notFoundMsg);
        setChecklistOverlayData(null);
        setChecklistOverlayFile(null);
        setChecklistOverlayTitle(title);
        setChecklistOverlayOpen(true);
        return;
      }
      setLoading(true);
      try {
        const md = await readMarkdownFileText(entry, mode);
        const data = parsePlanBoardMarkdown(md);
        if (!data.sections?.length) {
          setChecklistOverlayError(
            "文件中未解析到任何 `## 小节标题` 下的 `- [ ]` 条目；请用二级标题分节并写勾选行。"
          );
          setChecklistOverlayData(null);
          setChecklistOverlayFile(entry);
        } else {
          setChecklistOverlayError(null);
          setChecklistOverlayData(data);
          setChecklistOverlayFile(entry);
        }
        setChecklistOverlayTitle(title);
        setChecklistOverlayOpen(true);
      } catch (e) {
        setChecklistOverlayError(String(e.message || e));
        setChecklistOverlayData(null);
        setChecklistOverlayFile(null);
        setChecklistOverlayTitle(title);
        setChecklistOverlayOpen(true);
      } finally {
        setLoading(false);
      }
    },
    [files, mode]
  );

  const openPlanBoardFromHub = useCallback(
    () =>
      openChecklistBoardFromHub(
        isPlanBoardFile,
        "进度规划看板",
        "未找到「进度规划看板」：请保留 周期记录/进度规划看板.md，并用桌面版打开 Study 根目录。"
      ),
    [openChecklistBoardFromHub]
  );

  const openStatusBoardFromHub = useCallback(
    () =>
      openChecklistBoardFromHub(
        isStatusBoardFile,
        "个人状态情况看板",
        "未找到「个人状态情况看板」：请保留 周期记录/个人状态情况看板.md，并用桌面版打开 Study 根目录。"
      ),
    [openChecklistBoardFromHub]
  );

  const applyChecklistToggle = useCallback(
    async (sectionIndex, itemIndex, done, sourceFile) => {
      const entry = sourceFile;
      if (!entry) return;
      if (!canNativeSave || typeof window.electronAPI?.writeMarkdownFile !== "function") {
        setError("勾选保存需要桌面版并打开 Study 文件夹（浏览器模式请手动改 md）");
        return;
      }
      setChecklistSaving(true);
      setError("");
      try {
        const md =
          activeFile?.fullPath === entry.fullPath
            ? content
            : await readMarkdownFileText(entry, mode);
        const nextMd = togglePlanBoardItem(md, sectionIndex, itemIndex, done);
        await window.electronAPI.writeMarkdownFile(entry.fullPath, nextMd);
        const data = parsePlanBoardMarkdown(nextMd);
        if (activeFile?.fullPath === entry.fullPath) {
          setContent(nextMd);
          setDirty(false);
        }
        if (checklistOverlayFile?.fullPath === entry.fullPath) {
          setChecklistOverlayData(data);
        }
        setMessage("已保存勾选");
      } catch (e) {
        setError(e?.message || "勾选保存失败");
      } finally {
        setChecklistSaving(false);
      }
    },
    [activeFile, content, mode, canNativeSave, checklistOverlayFile]
  );

  const openChecklistOverlayInReader = useCallback(() => {
    if (!checklistOverlayFile) return;
    setChecklistOverlayOpen(false);
    setAppSection("reader");
    void openFile(checklistOverlayFile);
  }, [checklistOverlayFile, openFile]);

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
      if (canNativeSave && activeFile && isStudyProgressFile(activeFile)) {
        const next = parseStudyProgressFromMarkdown(content, {
          math: mathCatalog,
          cs408: catalog408,
        });
        setStudyProgress(next);
        writeStudyProgress(next);
        upsertTodaySnapshot(computeOverallProgressScore(next, mathCatalog, catalog408));
        setSnapshotTick((t) => t + 1);
      }
      if (canNativeSave && activeFile && isVideoProgressFile(activeFile)) {
        const next = parseVideoProgressFromMarkdown(content);
        const merged = mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), next);
        setVideoProgress(merged);
        writeVideoProgress(merged);
      }
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
      setStudyTimeTick((t) => t + 1);
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
      imagePath: randomQuizItem.imagePath || undefined,
      quizItemId: randomQuizItem.id,
      quizSelectedSubjects,
      quizFileOnlyMode,
      secondPlanFocus: quizFileOnlyMode ? quizSecondPlanFocus || undefined : undefined,
    });
    setQuizLogVersion((v) => v + 1);
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
      // 学习笔记 / 首页 / 进度中心等区块有自己的输入框；勿把 reader 的撤销、保存绑到全局
      if (appSection !== "reader") return;
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
  }, [appSection, activeFile, content, dirty, mode, canNativeSave]);

  return (
    <div className="app">
      {appSection === "home" && (
        <HomeHub
          onSelectSection={selectAppSection}
          dailySecondPass={homeDailySecondPass}
          onOpenDailySecondPassInReader={openDailySecondPassInReader}
          dailyMemorize={homeDailyMemorize}
          onOpenDailyMemorizeInReader={openDailyMemorizeInReader}
        />
      )}
      {appSection === "notes" && (
        <NotesWorkspace onBack={() => setAppSection("home")} />
      )}
      {appSection === "progress" && (
        <ProgressHub
          onBack={() => setAppSection("home")}
          onOpenStudyProgress={() => setStudyProgressOpen(true)}
          onOpenVideoProgress={() => setVideoProgressOpen(true)}
          onOpenWeekly={openWeeklyProgress}
          onOpenStudyTime={openStudyTimeCalendar}
          onOpenPath={() => setStudyPathOpen(true)}
          onOpenQuizStats={() => setQuizStatsOpen(true)}
          onOpenFinance={() => setFinanceOpen(true)}
          onOpenSchoolTargets={openSchoolTargetsFromHub}
          onOpenPlanBoard={openPlanBoardFromHub}
          onOpenStatusBoard={openStatusBoardFromHub}
          currentScore={weeklyProgressStats.currentScore}
        />
      )}
      {appSection === "reader" && (
        <>
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
        <div className="topbar-group" role="group" aria-label="资料库">
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={goReaderHome}>
            返回首页
          </button>
          <button type="button" className="topbar-btn topbar-btn--primary" onClick={openFolder}>
            {hasApi ? "打开文件夹" : "网页 · 选择文件夹"}
          </button>
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            onClick={saveContent}
            disabled={!activeFile || !dirty}
            title={activeFile && dirty ? "保存（Ctrl+S）" : undefined}
          >
            保存
          </button>
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={refreshUi}>
            刷新界面
          </button>
        </div>
        <div className="topbar-group" role="group" aria-label="练习">
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={openRandomQuiz}>
            随机练习
          </button>
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            onClick={() => setQuizStatsOpen(true)}
          >
            练习统计
          </button>
        </div>
        <div className="topbar-group" role="group" aria-label="规划">
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={() => setStudyPathOpen(true)}>
            学习路径
          </button>
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={openWeeklyProgress}>
            本周进度
          </button>
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={openStudyTimeCalendar}>
            学习时长
          </button>
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={() => setStudyProgressOpen(true)}>
            学习进度
          </button>
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={() => setVideoProgressOpen(true)}>
            视频进度
          </button>
        </div>
        <div className="topbar-group" role="group" aria-label="工具">
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={() => setFinanceOpen(true)}>
            记账
          </button>
        </div>
        <span className="topbar-spacer" aria-hidden="true" />
        <div className="topbar-tail">
          <div className="view-switch" role="group" aria-label="视图模式">
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
          <div className="folder-path" title={folderPath || undefined}>
            {folderPath || "未选择文件夹"}
          </div>
          {dirty && <span className="dirty">未保存</span>}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar" style={{ width: sidebarWidth, flexShrink: 0 }}>
          <h2>Markdown 文件树</h2>
          {files.length === 0 && (
            <p className="hint">
              支持 `.md` 和 `.mdc`
              {!hasApi
                ? "。当前在浏览器中打开，只能上传文件夹；请关闭此页，在项目目录运行 npm run dev，使用弹出的 Electron 桌面窗口并点「打开文件夹」选本地目录。"
                : ""}
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
              {!loading &&
                !error &&
                activeFile &&
                isSchoolTargetsFile(activeFile) &&
                viewMode === "edit" && (
                  <p className="hint">
                    当前为择校目标文件：切换到「预览」或「分栏」可查看数据看板。
                  </p>
                )}
              {!loading &&
                !error &&
                activeFile &&
                isChecklistBoardFile(activeFile) &&
                viewMode === "edit" && (
                  <p className="hint">
                    当前为{activeChecklistBoardTitle}：切换到「预览」或「分栏」可点击勾选；亦可在正文编辑{" "}
                    <code>- [ ]</code> / <code>- [x]</code>。
                  </p>
                )}
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
              <div className="viewer-preview-stack viewer-fill">
                {showChecklistBoardDash && (
                  <PlanBoardDashboard
                    data={checklistBoardData}
                    title={activeChecklistBoardTitle}
                    interactive={canNativeSave}
                    saving={checklistSaving}
                    onToggleItem={(si, ii, done) =>
                      applyChecklistToggle(si, ii, done, activeFile)
                    }
                  />
                )}
                {showSchoolTargetsDash && (
                  <SchoolTargetsDashboard data={schoolTargetsData} />
                )}
                <article
                  className="markdown viewer-fill viewer-markdown-scroll"
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdownWithMath(marked, previewMarkdown || ""),
                  }}
                />
              </div>
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
                  <div className="viewer-preview-stack viewer-fill">
                    {showChecklistBoardDash && (
                  <PlanBoardDashboard
                    data={checklistBoardData}
                    title={activeChecklistBoardTitle}
                    interactive={canNativeSave}
                    saving={checklistSaving}
                    onToggleItem={(si, ii, done) =>
                      applyChecklistToggle(si, ii, done, activeFile)
                    }
                  />
                )}
                    {showSchoolTargetsDash && (
                      <SchoolTargetsDashboard data={schoolTargetsData} />
                    )}
                    <article
                      className="markdown viewer-fill viewer-markdown-scroll"
                      dangerouslySetInnerHTML={{
                        __html: parseMarkdownWithMath(marked, previewMarkdown || ""),
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
        </>
      )}

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
                随机练习
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

      {quizStatsOpen && (
        <QuizStatsDashboard stats={quizStatsData} onClose={() => setQuizStatsOpen(false)} />
      )}

      {studyProgressOpen && (
        <StudyProgressDashboard
          data={studyProgress}
          onChange={persistStudyProgress}
          onClose={() => setStudyProgressOpen(false)}
          sourceHint={progressSourceHint}
          mathCatalog={mathCatalog}
          zhangyu1000Catalog={zhangyu1000Catalog}
          catalog408={catalog408}
          catalogHint={progressCatalogHint}
        />
      )}

      {videoProgressOpen && (
        <VideoProgressDashboard
          data={videoProgress}
          onChange={persistVideoProgress}
          onClose={() => setVideoProgressOpen(false)}
          sourceHint={videoProgressSourceHint}
          weekStart={weeklyProgressStats.startStr}
          weekEnd={weeklyProgressStats.endStr}
          folderPath={folderPath}
          hasApi={hasApi}
        />
      )}

      {studyPathOpen && (
        <StudyPathDashboard
          nodes={planPathNodes}
          doneMap={planPathDone}
          onToggleDone={(id) => {
            setPlanPathDone((prev) => {
              const next = { ...prev, [id]: !prev[id] };
              writePlanPathDone(next);
              return next;
            });
          }}
          onClose={() => setStudyPathOpen(false)}
        />
      )}

      {studyTimeOpen && (
        <StudyTimeCalendarDashboard
          year={studyTimeYear}
          month={studyTimeMonth}
          byDate={studyTimeByDate}
          loading={studyTimeLoading}
          error={studyTimeError}
          selectedDate={studyTimeSelected}
          onSelectDate={setStudyTimeSelected}
          onPrevMonth={() => {
            if (studyTimeMonth <= 1) {
              setStudyTimeYear((y) => y - 1);
              setStudyTimeMonth(12);
            } else setStudyTimeMonth((m) => m - 1);
          }}
          onNextMonth={() => {
            if (studyTimeMonth >= 12) {
              setStudyTimeYear((y) => y + 1);
              setStudyTimeMonth(1);
            } else setStudyTimeMonth((m) => m + 1);
          }}
          onRefresh={() => setStudyTimeTick((t) => t + 1)}
          folderHint={folderPath ? `已绑定：${folderPath}` : ""}
          onClose={() => setStudyTimeOpen(false)}
          onAddQuickThreeHour={handleAddQuickThreeHour}
          onRemovePendingBlock={handleRemovePendingBlock}
          onCopyPendingForAgent={handleCopyPendingForAgent}
          pendingSyncHint={
            canNativeSave && folderPath
              ? "已同步至 周期记录/学习时长待同步.md"
              : "仅本机浏览器缓存（请打开 Study 文件夹以写盘）"
          }
        />
      )}

      {weeklyProgressOpen && (
        <WeeklyProgressDashboard
          currentScore={weeklyProgressStats.currentScore}
          weekStart={weeklyProgressStats.startStr}
          weekEnd={weeklyProgressStats.endStr}
          weekDelta={weeklyProgressStats.delta}
          weekReason={weeklyProgressStats.reason}
          snapshotsInWindow={weeklyProgressStats.snapshotsInWindow}
          dayRows={weeklyProgressStats.dayRows}
          dailyReportDays={weeklyProgressStats.dailyReportDays}
          onClose={() => setWeeklyProgressOpen(false)}
        />
      )}

      {financeOpen && (
        <FinanceDashboard
          state={financeState}
          onChange={setFinanceState}
          onClose={() => setFinanceOpen(false)}
        />
      )}

      {checklistOverlayOpen && (
        <div
          className="quiz-stats-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checklist-overlay-title"
        >
          <div className="quiz-stats-panel quiz-stats-panel--wide">
            <div className="quiz-stats-toolbar">
              <h2 id="checklist-overlay-title" className="quiz-stats-title">
                {checklistOverlayTitle}
              </h2>
              <div className="quiz-stats-toolbar-btns">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setChecklistOverlayOpen(false)}
                >
                  关闭（Esc）
                </button>
              </div>
            </div>
            {checklistOverlayError ? (
              <p className="quiz-stats-empty">{checklistOverlayError}</p>
            ) : null}
            {checklistOverlayData?.sections?.length ? (
              <PlanBoardDashboard
                data={checklistOverlayData}
                title={checklistOverlayTitle}
                embedded
                interactive={canNativeSave}
                saving={checklistSaving}
                onToggleItem={(si, ii, done) =>
                  applyChecklistToggle(si, ii, done, checklistOverlayFile)
                }
                onOpenInEditor={
                  checklistOverlayFile ? openChecklistOverlayInReader : undefined
                }
              />
            ) : !checklistOverlayError ? (
              <p className="quiz-stats-empty">暂无小节数据。</p>
            ) : null}
          </div>
        </div>
      )}

      {schoolTargetsOpen && (
        <div
          className="quiz-stats-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="school-targets-hub-title"
        >
          <div className="quiz-stats-panel">
            <div className="quiz-stats-toolbar">
              <h2 id="school-targets-hub-title" className="quiz-stats-title">
                择校目标
              </h2>
              <div className="quiz-stats-toolbar-btns">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setSchoolTargetsOpen(false)}
                >
                  关闭（Esc）
                </button>
              </div>
            </div>
            {schoolTargetsModalError ? (
              <p className="quiz-stats-empty">{schoolTargetsModalError}</p>
            ) : null}
            {schoolTargetsModalData?.groups?.length ? (
              <SchoolTargetsDashboard data={schoolTargetsModalData} showTitleBar={false} />
            ) : !schoolTargetsModalError ? (
              <p className="quiz-stats-empty">暂无表格数据。</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
