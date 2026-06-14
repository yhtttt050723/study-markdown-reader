import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { parseMarkdownWithMath } from "./markdownRender.js";
import { NoteSubjectIcon } from "./noteSubjectIcons.jsx";
import { localImageProtocolUrlFromRaw } from "./markdownQuiz.js";
import {
  newNoteId,
  coerceUpdatedAt,
  normalizeNotesState,
  readQuickNotesState,
  writeQuickNotesState,
} from "./quickNotes.js";
import { WorkspaceBackBar } from "./WorkspaceChrome.jsx";
import { NoteKnowledgeMap, buildTreeFromNotes } from "./NoteKnowledgeMap.jsx";
import {
  LS_NOTES_EDITOR_RATIO,
  LS_NOTES_TAB_COMPLETE,
  readStoredNumber,
  trySetLocalStorage,
} from "./storageKeys.js";
import { localYmd } from "./studyDailyTime.js";
import {
  fetchNoteCompletion,
  isTabCompleteEnabled,
  setTabCompleteEnabled,
} from "./noteTabComplete.js";
import { mergeQuizWrongIntoQuickNotes } from "./quizNotesSync.js";
import {
  insertCodeFenceAtSelection,
  insertHeadingAtSelection,
  insertHorizontalRuleAtSelection,
  insertImageMarkdownAtSelection,
  insertLinePrefixAtSelection,
  insertLinkAtSelection,
  insertSubjectBlockAtSelection,
  insertWrapAtSelection,
  leadingNewlineIfNeeded,
  NOTE_CODE_FENCE_LANGS,
  NOTE_SUBJECT_BLOCK_PRESETS,
  replaceSelection,
} from "./noteEditorInsert.js";
import {
  kbApplyRefine,
  kbDeleteNote,
  kbGetNotes,
  kbGetTree,
  kbHealth,
  kbPutNote,
  kbRefineNote,
  kbSuggestTagsFromOllama,
} from "./kbApi.js";

function formatNoteTime(updatedAt) {
  const s =
    updatedAt instanceof Date
      ? updatedAt.toISOString()
      : typeof updatedAt === "string"
        ? updatedAt
        : updatedAt != null
          ? String(updatedAt)
          : "";
  if (!s) return "";
  return s.slice(0, 16).replace("T", " ");
}

function firstLineTitle(body) {
  const line = String(body || "")
    .split("\n")
    .find((l) => l.trim());
  if (!line) return "未命名";
  const t = line.replace(/^#+\s*/, "").trim().slice(0, 80);
  return t || "未命名";
}

function parseKeywords(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw || "")
    .split(/[,，;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function bytesToBase64(bytes) {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) {
    bin += String.fromCharCode(u8[i]);
  }
  return btoa(bin);
}

function extFromImageMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m === "image/png") return ".png";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  return ".png";
}

export function NotesWorkspace({ onBack }) {
  const textareaRef = useRef(null);
  const notesEditorSplitRef = useRef(null);
  const insertCaretRef = useRef(null);
  const completeAbortRef = useRef(null);
  const completeDebounceRef = useRef(null);
  const cursorPosRef = useRef(0);

  const [notesEditorRatio, setNotesEditorRatio] = useState(() =>
    readStoredNumber(LS_NOTES_EDITOR_RATIO, 0.72, 0.38, 0.9)
  );

  const [state, setState] = useState(() => readQuickNotesState());
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState("edit");
  const [kbOk, setKbOk] = useState(null);
  const [kbError, setKbError] = useState("");
  const [kbRemoteCount, setKbRemoteCount] = useState(0);
  const [kbEmbed, setKbEmbed] = useState(false);
  const [kbOllama, setKbOllama] = useState(false);
  const [kbOllamaModel, setKbOllamaModel] = useState("");
  const [treeRemote, setTreeRemote] = useState(null);
  const [filterL1, setFilterL1] = useState(null);
  const [filterL2, setFilterL2] = useState(null);
  const [reindexOnSync, setReindexOnSync] = useState(false);
  const [refineHint, setRefineHint] = useState(null);
  const [kbBusy, setKbBusy] = useState(false);
  /** Ctrl+S：拦截默认「保存网页」，笔记仍由 state→localStorage 自动持久化 */
  const [saveShortcutHint, setSaveShortcutHint] = useState(null);
  const [tabCompleteOn, setTabCompleteOn] = useState(() => isTabCompleteEnabled());
  const [completeSuggestion, setCompleteSuggestion] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeHint, setCompleteHint] = useState("");

  useEffect(() => {
    writeQuickNotesState(state);
  }, [state]);

  useEffect(() => {
    let hideTimer;
    const onKeyCapture = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key?.toLowerCase?.() ?? "";
      if (k !== "s") return;
      e.preventDefault();
      e.stopPropagation();
      setSaveShortcutHint("已保存到本地（smr-quick-notes）。");
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setSaveShortcutHint(null), 2800);
    };
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("keydown", onKeyCapture, true);
      clearTimeout(hideTimer);
    };
  }, []);

  const refreshKbMeta = useCallback(async () => {
    try {
      const h = await kbHealth();
      const online = Boolean(h.ok && h.pg);
      setKbOk(online);
      setKbError(online ? "" : h.error || "知识库未就绪");
      setKbEmbed(Boolean(h.embedding));
      setKbOllama(Boolean(h.ollama));
      setKbOllamaModel(typeof h.ollamaModel === "string" ? h.ollamaModel : "");
      if (online) {
        const [t, notesRes] = await Promise.all([kbGetTree(), kbGetNotes()]);
        setTreeRemote(t.tree || []);
        setKbRemoteCount(Array.isArray(notesRes.notes) ? notesRes.notes.length : 0);
      } else {
        setTreeRemote(null);
        setKbRemoteCount(0);
      }
    } catch (e) {
      setKbOk(false);
      setKbError(String(e.message || e));
      setKbEmbed(false);
      setKbOllama(false);
      setKbOllamaModel("");
      setTreeRemote(null);
      setKbRemoteCount(0);
    }
  }, []);

  useEffect(() => {
    refreshKbMeta();
  }, [refreshKbMeta]);

  const active = useMemo(() => {
    const aid = state.activeId != null ? String(state.activeId) : null;
    if (!aid) return null;
    return state.notes.find((n) => String(n.id) === aid) ?? null;
  }, [state.notes, state.activeId]);

  const treeData = useMemo(() => {
    if (treeRemote && treeRemote.length > 0) return treeRemote;
    return buildTreeFromNotes(state.notes);
  }, [treeRemote, state.notes]);

  const filteredNotes = useMemo(() => {
    let list = state.notes
      .slice()
      .sort((a, b) =>
        coerceUpdatedAt(b.updatedAt).localeCompare(coerceUpdatedAt(a.updatedAt)),
      );
    if (filterL1) list = list.filter((n) => (n.tagL1 || "未分类") === filterL1);
    if (filterL2) list = list.filter((n) => (n.tagL2 || "未分类") === filterL2);
    return list;
  }, [state.notes, filterL1, filterL2]);

  const patchActive = useCallback((patch) => {
    setState((prev) => {
      const aid = prev.activeId != null ? String(prev.activeId) : null;
      if (!aid) return prev;
      const now = new Date().toISOString();
      const notes = prev.notes.map((n) =>
        String(n.id) === aid ? { ...n, ...patch, updatedAt: now } : n
      );
      return { ...prev, notes };
    });
  }, []);

  const updateActiveBody = useCallback((body) => {
    setState((prev) => {
      const aid = prev.activeId != null ? String(prev.activeId) : null;
      if (!aid) return prev;
      const now = new Date().toISOString();
      const notes = prev.notes.map((n) =>
        String(n.id) === aid
          ? {
              ...n,
              body,
              title: firstLineTitle(body),
              updatedAt: now,
            }
          : n
      );
      return { ...prev, notes };
    });
  }, []);

  const splitPreviewHtml = useMemo(() => {
    try {
      return parseMarkdownWithMath(marked, active?.body ?? "");
    } catch {
      return "<p>预览解析失败</p>";
    }
  }, [active?.body]);

  useLayoutEffect(() => {
    const caret = insertCaretRef.current;
    if (caret == null) return;
    insertCaretRef.current = null;
    const ta = textareaRef.current;
    if (!ta || preview || panel !== "edit") return;
    const c = Math.min(Math.max(0, caret), ta.value.length);
    ta.focus();
    ta.setSelectionRange(c, c);
  }, [active?.body, active?.id, preview, panel]);

  const getEditorSelection = useCallback(() => {
    const body = active?.body ?? "";
    const ta = textareaRef.current;
    if (!ta) {
      return { start: body.length, end: body.length };
    }
    return {
      start: Math.min(ta.selectionStart, ta.value.length),
      end: Math.min(ta.selectionEnd, ta.value.length),
    };
  }, [active?.body]);

  const insertSubjectBlock = useCallback(
    (title) => {
      if (!active || preview || panel !== "edit") return;
      const body = active.body ?? "";
      const { start, end } = getEditorSelection();
      const { nextBody, caret } = insertSubjectBlockAtSelection(
        body,
        start,
        end,
        title,
        localYmd(),
      );
      insertCaretRef.current = caret;
      updateActiveBody(nextBody);
    },
    [active, preview, panel, getEditorSelection, updateActiveBody]
  );

  const insertCodeBlock = useCallback(
    (lang) => {
      if (!active || preview || panel !== "edit") return;
      const body = active.body ?? "";
      const { start, end } = getEditorSelection();
      const { nextBody, caret } = insertCodeFenceAtSelection(body, start, end, lang);
      insertCaretRef.current = caret;
      updateActiveBody(nextBody);
    },
    [active, preview, panel, getEditorSelection, updateActiveBody]
  );

  const applyInsert = useCallback(
    (fn) => {
      if (!active || preview || panel !== "edit") return;
      const body = active.body ?? "";
      const { start, end } = getEditorSelection();
      const { nextBody, caret } = fn(body, start, end);
      insertCaretRef.current = caret;
      updateActiveBody(nextBody);
    },
    [active, preview, panel, getEditorSelection, updateActiveBody]
  );

  const insertLink = useCallback(() => {
    if (!active || preview || panel !== "edit") return;
    const body = active.body ?? "";
    const { start, end } = getEditorSelection();
    const selected = body.slice(start, end).trim();
    const url = window.prompt("链接地址（https://…）", "https://");
    if (url === null) return;
    const label = window.prompt("显示文字", selected || url);
    if (label === null) return;
    const { nextBody, caret } = insertLinkAtSelection(body, start, end, label, url);
    insertCaretRef.current = caret;
    updateActiveBody(nextBody);
  }, [active, preview, panel, getEditorSelection, updateActiveBody]);

  const insertImageLink = useCallback(() => {
    if (!active || preview || panel !== "edit") return;
    const url = window.prompt("图片路径或 URL（桌面版也可直接 Ctrl+V 粘贴截图）", "");
    if (url === null || !String(url).trim()) return;
    const alt = window.prompt("图片说明", "图片");
    if (alt === null) return;
    applyInsert((body, start, end) =>
      insertImageMarkdownAtSelection(body, start, end, alt, String(url).trim()),
    );
  }, [active, preview, panel, applyInsert]);

  const startNotesOutlineResize = useCallback((e) => {
    e.preventDefault();
    const splitEl = notesEditorSplitRef.current;
    if (!splitEl) return;
    let lastRatio = notesEditorRatio;
    const onMove = (ev) => {
      const r = splitEl.getBoundingClientRect();
      if (r.width < 80) return;
      let ratio = (ev.clientX - r.left) / r.width;
      ratio = Math.max(0.38, Math.min(0.9, ratio));
      lastRatio = ratio;
      setNotesEditorRatio(ratio);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      trySetLocalStorage(LS_NOTES_EDITOR_RATIO, String(lastRatio));
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [notesEditorRatio]);

  const handleNoteImagePaste = useCallback(
    async (e) => {
      const files = e.clipboardData?.files;
      if (!files?.length || !active) return;
      const f = [...files].find((x) => x.type?.startsWith("image/"));
      if (!f) return;
      const api = window.electronAPI?.saveNotePasteImage;
      if (!api) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const buf = await f.arrayBuffer();
        const base64 = bytesToBase64(buf);
        const nameMatch = (f.name || "").match(/(\.[a-z0-9]+)$/i);
        const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
        let ext = nameMatch && allowed.has(nameMatch[1].toLowerCase())
          ? nameMatch[1].toLowerCase()
          : extFromImageMime(f.type);
        if (ext === ".jpeg") ext = ".jpg";
        const absPath = await api({ noteId: active.id, base64, ext });
        const url = localImageProtocolUrlFromRaw(absPath);
        if (!url) {
          setRefineHint({ err: "无法生成图片链接（路径异常）。" });
          return;
        }
        const body = active.body ?? "";
        const ta = textareaRef.current;
        const start = ta ? ta.selectionStart : body.length;
        const end = ta ? ta.selectionEnd : body.length;
        const lead = leadingNewlineIfNeeded(body, start);
        const md = `${lead}![](${url})\n`;
        const { nextBody, caret } = replaceSelection(body, start, end, md);
        insertCaretRef.current = caret;
        updateActiveBody(nextBody);
        setRefineHint({ ok: "已粘贴图片（本机 userData/quick-notes-assets）。" });
      } catch (err) {
        setRefineHint({ err: String(err?.message || err) });
      }
    },
    [active, updateActiveBody]
  );

  const addNote = () => {
    const id = newNoteId();
    const now = new Date().toISOString();
    const note = {
      id,
      title: "新笔记",
      body: "",
      updatedAt: now,
      tagL1: "未分类",
      tagL2: "未分类",
      importance: 3,
      keywords: [],
      vectorCluster: "",
    };
    setState((prev) => ({
      ...prev,
      notes: [note, ...prev.notes],
      activeId: id,
    }));
    setPreview(false);
    setRefineHint(null);
  };

  const removeActive = () => {
    if (!state.activeId) return;
    if (!window.confirm("删除当前笔记？无法撤销。")) return;
    const id = state.activeId;
    setState((prev) => {
      const notes = prev.notes.filter((n) => n.id !== prev.activeId);
      return {
        notes,
        activeId: notes[0]?.id ?? null,
      };
    });
    if (kbOk) {
      kbDeleteNote(id)
        .then(() => refreshKbMeta())
        .catch(() => {});
    }
  };

  const syncNoteToKb = async () => {
    if (!active || !kbOk) return;
    setKbBusy(true);
    setRefineHint(null);
    try {
      await kbPutNote(active.id, {
        title: active.title,
        body: active.body,
        tagL1: active.tagL1 || "未分类",
        tagL2: active.tagL2 || "未分类",
        importance: active.importance ?? 3,
        keywords: active.keywords || [],
        vectorCluster: active.vectorCluster || "",
        reindex: reindexOnSync,
      });
      await refreshKbMeta();
      setRefineHint({ ok: "已同步到知识库。" });
    } catch (e) {
      setRefineHint({ err: String(e.message || e) });
    } finally {
      setKbBusy(false);
    }
  };

  const pullFromKb = async () => {
    if (!kbOk) return;
    if (!window.confirm("用知识库中的笔记覆盖本地笔记列表？（当前 smr-quick-notes 将被替换）")) return;
    setKbBusy(true);
    try {
      const { notes } = await kbGetNotes();
      const next = normalizeNotesState({
        notes: Array.isArray(notes) ? notes : [],
        activeId: notes?.[0]?.id,
      });
      if (next.notes.length === 0) {
        setRefineHint({ err: "知识库中没有可导入的笔记。" });
        return;
      }
      setState(next);
      writeQuickNotesState(next);
      setPreview(false);
      setPanel("edit");
      setFilterL1(null);
      setFilterL2(null);
      setRefineHint({
        ok: `已从知识库拉取 ${next.notes.length} 条。请在「编辑」标签下修改正文（勿停留在「预览」）。`,
      });
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (e) {
      setRefineHint({ err: String(e.message || e) });
    } finally {
      setKbBusy(false);
    }
  };

  const runRefine = async () => {
    if (!active || !kbOk) return;
    setKbBusy(true);
    setRefineHint(null);
    try {
      const r = await kbRefineNote(active.id);
      setRefineHint({
        refine: r,
      });
    } catch (e) {
      setRefineHint({ err: String(e.message || e) });
    } finally {
      setKbBusy(false);
    }
  };

  const applyRefine = async () => {
    if (!active || !refineHint?.refine) return;
    const r = refineHint.refine;
    setKbBusy(true);
    try {
      await kbApplyRefine(active.id, {
        tagL2: r.suggestedTagL2,
        keywords: r.suggestedKeywords || [],
        vectorCluster: r.vectorCluster || "",
      });
      patchActive({
        tagL2: r.suggestedTagL2,
        keywords: r.suggestedKeywords || [],
        vectorCluster: r.vectorCluster || "",
      });
      await refreshKbMeta();
      setRefineHint({ ok: "已应用向量建议并写回本地与知识库。" });
    } catch (e) {
      setRefineHint({ err: String(e.message || e) });
    } finally {
      setKbBusy(false);
    }
  };

  const suggestTagsWithOllama = async () => {
    if (!active || !kbOk || !kbOllama) return;
    setKbBusy(true);
    setRefineHint(null);
    try {
      const r = await kbSuggestTagsFromOllama({
        title: active.title,
        body: active.body || "",
      });
      patchActive({
        tagL1: r.tagL1,
        tagL2: r.tagL2,
        importance: r.importance,
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
      });
      setRefineHint({ ok: `本地模型已写入标签（${kbOllamaModel || "Ollama"}）。摘要：${r.summary || "—"}` });
    } catch (e) {
      setRefineHint({ err: String(e.message || e) });
    } finally {
      setKbBusy(false);
    }
  };

  const toggleTabComplete = useCallback(() => {
    setTabCompleteOn((prev) => {
      const next = !prev;
      setTabCompleteEnabled(next);
      trySetLocalStorage(LS_NOTES_TAB_COMPLETE, next ? "1" : "0");
      if (!next) {
        completeAbortRef.current?.abort();
        setCompleteSuggestion("");
        setCompleteHint("");
      }
      return next;
    });
  }, []);

  const acceptCompleteSuggestion = useCallback(() => {
    if (!completeSuggestion || !active) return false;
    const body = active.body ?? "";
    const start = cursorPosRef.current;
    const end = start;
    const { nextBody, caret } = replaceSelection(body, start, end, completeSuggestion);
    insertCaretRef.current = caret;
    updateActiveBody(nextBody);
    setCompleteSuggestion("");
    setCompleteHint("");
    return true;
  }, [active, completeSuggestion, updateActiveBody]);

  const requestNoteCompletion = useCallback(
    async (force = false) => {
      if (!active || !kbOllama || !tabCompleteOn || preview || panel !== "edit") return;
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      cursorPosRef.current = start;
      if (start !== end && !force) return;

      completeAbortRef.current?.abort();
      const ac = new AbortController();
      completeAbortRef.current = ac;
      setCompleteBusy(true);
      setCompleteHint(force ? "本地模型续写中…" : "预读上下文…");
      try {
        const fullBody = active.body ?? "";
        const text = await fetchNoteCompletion(
          {
            title: active.title,
            prefix: fullBody.slice(0, start),
            suffix: fullBody.slice(start),
          },
          ac.signal,
        );
        if (ac.signal.aborted) return;
        if (!text) {
          setCompleteSuggestion("");
          setCompleteHint("模型未给出续写（可换行或写几个字再 Tab）");
          return;
        }
        setCompleteSuggestion(text);
        setCompleteHint("Tab 采纳 · Esc 取消");
      } catch (e) {
        if (e?.name === "AbortError") return;
        setCompleteSuggestion("");
        setCompleteHint(String(e.message || e));
      } finally {
        if (!ac.signal.aborted) setCompleteBusy(false);
      }
    },
    [active, kbOllama, tabCompleteOn, preview, panel],
  );

  const scheduleNoteCompletion = useCallback(() => {
    if (!kbOllama || !tabCompleteOn || preview || panel !== "edit") return;
    clearTimeout(completeDebounceRef.current);
    setCompleteSuggestion("");
    completeAbortRef.current?.abort();
    completeDebounceRef.current = window.setTimeout(() => {
      void requestNoteCompletion(false);
    }, 1400);
  }, [kbOllama, tabCompleteOn, preview, panel, requestNoteCompletion]);

  const handleNoteEditorChange = useCallback(
    (value) => {
      updateActiveBody(value);
      const ta = textareaRef.current;
      if (ta) cursorPosRef.current = ta.selectionStart;
      scheduleNoteCompletion();
    },
    [updateActiveBody, scheduleNoteCompletion],
  );

  const handleNoteEditorSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) cursorPosRef.current = ta.selectionStart;
  }, []);

  const handleNoteEditorKeyDown = useCallback(
    (e) => {
      if (!kbOllama || !tabCompleteOn || preview || panel !== "edit") return;
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        if (completeSuggestion) {
          acceptCompleteSuggestion();
        } else {
          void requestNoteCompletion(true);
        }
        return;
      }
      if (e.key === "Escape" && (completeSuggestion || completeBusy)) {
        e.preventDefault();
        completeAbortRef.current?.abort();
        setCompleteSuggestion("");
        setCompleteHint("");
        setCompleteBusy(false);
      }
    },
    [
      kbOllama,
      tabCompleteOn,
      preview,
      panel,
      completeSuggestion,
      completeBusy,
      acceptCompleteSuggestion,
      requestNoteCompletion,
    ],
  );

  useEffect(() => {
    setCompleteSuggestion("");
    setCompleteHint("");
    completeAbortRef.current?.abort();
    clearTimeout(completeDebounceRef.current);
  }, [active?.id, preview, panel]);

  return (
    <div className="notes-workspace">
      <WorkspaceBackBar onBack={onBack} title="学习笔记 · 知识库">
        <div className="notes-kb-status">
          {kbOk === null && <span className="notes-kb-pill">知识库检测中…</span>}
          {kbOk === false && (
            <>
              <span className="notes-kb-pill notes-kb-pill--off">知识库离线（仅本地 smr-quick-notes）</span>
              {kbError ? (
                <span className="notes-kb-msg notes-kb-msg--err" title={kbError}>
                  {kbError.length > 72 ? `${kbError.slice(0, 72)}…` : kbError}
                </span>
              ) : null}
            </>
          )}
          {kbOk && kbRemoteCount > 0 && (
            <button
              type="button"
              className="topbar-btn topbar-btn--primary"
              disabled={kbBusy}
              onClick={pullFromKb}
              title="PostgreSQL 中的笔记不会自动显示在左侧列表，需拉取到本机"
            >
              从知识库拉取（{kbRemoteCount} 条）
            </button>
          )}
          {kbOk && (
            <span className="notes-kb-pill notes-kb-pill--on">
              已连接 PostgreSQL
              {kbEmbed ? " · 可建向量" : " · 未配置 OPENAI 则仅标签树"}
            </span>
          )}
          {kbOk && kbOllama && (
            <span className="notes-kb-pill notes-kb-pill--on" title="本机 Ollama，可用于一键生成标签">
              Ollama · {kbOllamaModel || "已就绪"}
            </span>
          )}
          {kbOllama && (
            <label className="notes-tab-complete-toggle" title="停笔约 1.4s 自动预读；Tab 采纳续写">
              <input
                type="checkbox"
                checked={tabCompleteOn}
                onChange={toggleTabComplete}
              />
              Tab 补全
            </label>
          )}
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            disabled={kbBusy}
            onClick={refreshKbMeta}
          >
            刷新连接
          </button>
        </div>
      </WorkspaceBackBar>

      <div className="notes-workspace-toolbar">
        <div className="notes-tab-switch" role="tablist">
          <button
            type="button"
            role="tab"
            className={panel === "edit" ? "selected" : ""}
            onClick={() => setPanel("edit")}
          >
            编辑
          </button>
          <button
            type="button"
            role="tab"
            className={panel === "map" ? "selected" : ""}
            onClick={() => setPanel("map")}
          >
            知识树
          </button>
        </div>
        <div className="notes-workspace-actions">
          <button type="button" className="topbar-btn topbar-btn--secondary" onClick={addNote}>
            新建
          </button>
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            onClick={() => setPreview((p) => !p)}
            disabled={!active || panel !== "edit"}
          >
            {preview ? "编辑" : "预览"}
          </button>
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            onClick={removeActive}
            disabled={!active}
          >
            删除
          </button>
          <button
            type="button"
            className="topbar-btn topbar-btn--secondary"
            title="把 smr-quiz-log 中「做错」记录按科目写入/更新笔记，含题目图片链接"
            onClick={() => {
              const { state: next, message } = mergeQuizWrongIntoQuickNotes(state);
              setState(next);
              setRefineHint({ ok: message });
              setPanel("edit");
            }}
          >
            错题导入笔记
          </button>
          {kbOk && (
            <>
              <label className="notes-reindex-check">
                <input
                  type="checkbox"
                  checked={reindexOnSync}
                  onChange={(e) => setReindexOnSync(e.target.checked)}
                  disabled={!kbEmbed}
                />
                同步时重建向量
              </label>
              <button
                type="button"
                className="topbar-btn topbar-btn--secondary"
                disabled={!active || kbBusy}
                onClick={syncNoteToKb}
              >
                同步到知识库
              </button>
              <button
                type="button"
                className="topbar-btn topbar-btn--secondary"
                disabled={kbBusy}
                onClick={pullFromKb}
              >
                从知识库拉取
              </button>
            </>
          )}
        </div>
      </div>

      {saveShortcutHint && (
        <p className="notes-kb-msg notes-kb-msg--ok notes-kb-msg--shortcut">{saveShortcutHint}</p>
      )}
      {refineHint?.ok && <p className="notes-kb-msg notes-kb-msg--ok">{refineHint.ok}</p>}
      {refineHint?.err && <p className="notes-kb-msg notes-kb-msg--err">{refineHint.err}</p>}
      {refineHint?.refine && (
        <div className="notes-refine-box">
          <p>
            <strong>向量近邻建议</strong>：二级标签 → {refineHint.refine.suggestedTagL2}；关键词建议：{" "}
            {(refineHint.refine.suggestedKeywords || []).join("、") || "—"}
          </p>
          <p className="notes-refine-cluster">
            聚类说明：<code>{refineHint.refine.vectorCluster}</code>
          </p>
          <button type="button" className="topbar-btn topbar-btn--primary" onClick={applyRefine} disabled={kbBusy}>
            应用建议到本地与库
          </button>
        </div>
      )}

      <div className="notes-workspace-body">
        {panel === "map" ? (
          <div className="notes-map-panel">
            <NoteKnowledgeMap
              tree={treeData}
              activeId={state.activeId}
              onPickNote={(id) => {
                setState((p) => ({ ...p, activeId: String(id) }));
                setPreview(false);
                setPanel("edit");
                setRefineHint(null);
              }}
              filterL1={filterL1}
              filterL2={filterL2}
              onFilterL1={setFilterL1}
              onFilterL2={setFilterL2}
            />
          </div>
        ) : null}

        <div className="notes-workspace-row">
        <aside className="notes-workspace-list">
          <h2 className="notes-workspace-list-h">
            列表
            {filterL1 || filterL2 ? (
              <button
                type="button"
                className="notes-filter-clear"
                onClick={() => {
                  setFilterL1(null);
                  setFilterL2(null);
                }}
              >
                清除筛选
              </button>
            ) : null}
          </h2>
          <ul>
            {filteredNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={String(n.id) === String(state.activeId) ? "active" : ""}
                  onClick={() => {
                    setState((p) => ({ ...p, activeId: String(n.id) }));
                    setPreview(false);
                    setRefineHint(null);
                  }}
                >
                  <span className="notes-item-title">{n.title}</span>
                  <span className="notes-item-tags">
                    {(n.tagL1 || "未分类")} › {(n.tagL2 || "未分类")}
                  </span>
                  <span className="notes-item-time">
                    {formatNoteTime(n.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="notes-workspace-main">
          {panel === "edit" && active && (
            <div className="notes-meta-panel">
              <label className="notes-meta-field">
                <span>一级标签（Skill 先判）</span>
                <input
                  type="text"
                  value={active.tagL1 ?? "未分类"}
                  onChange={(e) => patchActive({ tagL1: e.target.value })}
                  placeholder="如：数学 / 408 / 英语"
                />
              </label>
              <label className="notes-meta-field">
                <span>二级标签</span>
                <input
                  type="text"
                  value={active.tagL2 ?? "未分类"}
                  onChange={(e) => patchActive({ tagL2: e.target.value })}
                  placeholder="如：概率论 / 计组"
                />
              </label>
              <label className="notes-meta-field">
                <span>重点 1–5</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={active.importance ?? 3}
                  onChange={(e) =>
                    patchActive({
                      importance: Math.min(5, Math.max(1, Number(e.target.value) || 3)),
                    })
                  }
                />
              </label>
              <label className="notes-meta-field notes-meta-field--wide">
                <span>关键词（逗号分隔，供向量与检索）</span>
                <input
                  type="text"
                  value={(active.keywords || []).join(", ")}
                  onChange={(e) => patchActive({ keywords: parseKeywords(e.target.value) })}
                />
              </label>
              {active.vectorCluster ? (
                <p className="notes-vector-cluster">
                  向量聚类备注：<code>{active.vectorCluster}</code>
                </p>
              ) : null}
              {kbOk && kbEmbed && (
                <button
                  type="button"
                  className="topbar-btn topbar-btn--secondary"
                  disabled={!active || kbBusy}
                  onClick={runRefine}
                >
                  向量二次划分（近邻建议）
                </button>
              )}
              {kbOk && kbOllama && (
                <button
                  type="button"
                  className="topbar-btn topbar-btn--primary"
                  disabled={!active || kbBusy}
                  title="调用本机 Ollama（默认 qwen2.5:3b）解析正文并填入上方标签与关键词"
                  onClick={suggestTagsWithOllama}
                >
                  本地模型生成标签
                </button>
              )}
            </div>
          )}

          <div className="notes-workspace-editor">
            {!active ? (
              <p className="hint">
                {state.notes.length > 0
                  ? "请从左侧列表点选一条笔记后再编辑。"
                  : "暂无笔记，点击「新建」。"}
              </p>
            ) : panel === "edit" && preview ? (
              <>
                <p className="notes-kb-msg notes-kb-msg--err" style={{ margin: "0 0 8px", flexShrink: 0 }}>
                  当前为「预览」模式，正文不可改。点顶栏「编辑」回到输入。
                </p>
                <div
                  className="markdown notes-preview-pane"
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdownWithMath(marked, active.body || ""),
                  }}
                />
              </>
            ) : panel === "edit" ? (
              <>
                <div className="notes-insert-toolbar" aria-label="插入 Markdown 片段">
                  <span className="notes-insert-hint">
                    快捷插入 · 右侧实时预览 · 桌面版 <strong>Ctrl+V</strong> 可直接粘贴截图
                  </span>
                  <div className="notes-insert-group" role="group" aria-label="标题">
                    <span className="notes-insert-group-label">标题</span>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="二级标题 ##"
                      onClick={() => applyInsert((b, s, e) => insertHeadingAtSelection(b, s, e, 2, "标题"))}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="三级标题 ###"
                      onClick={() => applyInsert((b, s, e) => insertHeadingAtSelection(b, s, e, 3, "标题"))}
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="四级标题 ####"
                      onClick={() => applyInsert((b, s, e) => insertHeadingAtSelection(b, s, e, 4, "标题"))}
                    >
                      H4
                    </button>
                  </div>
                  <div className="notes-insert-group" role="group" aria-label="文字样式">
                    <span className="notes-insert-group-label">样式</span>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="加粗 **文字**"
                      onClick={() =>
                        applyInsert((b, s, e) => insertWrapAtSelection(b, s, e, "**", "**", "加粗"))
                      }
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="斜体 *文字*"
                      onClick={() =>
                        applyInsert((b, s, e) => insertWrapAtSelection(b, s, e, "*", "*", "斜体"))
                      }
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="行内代码"
                      onClick={() =>
                        applyInsert((b, s, e) => insertWrapAtSelection(b, s, e, "`", "`", "code"))
                      }
                    >
                      {"</>"}
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="删除线"
                      onClick={() =>
                        applyInsert((b, s, e) => insertWrapAtSelection(b, s, e, "~~", "~~", "删除"))
                      }
                    >
                      S̶
                    </button>
                  </div>
                  <div className="notes-insert-group" role="group" aria-label="块与列表">
                    <span className="notes-insert-group-label">块</span>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="引用"
                      onClick={() =>
                        applyInsert((b, s, e) => insertLinePrefixAtSelection(b, s, e, "> ", "引用"))
                      }
                    >
                      引用
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="无序列表"
                      onClick={() =>
                        applyInsert((b, s, e) => insertLinePrefixAtSelection(b, s, e, "- ", "列表项"))
                      }
                    >
                      列表
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="有序列表"
                      onClick={() =>
                        applyInsert((b, s, e) => insertLinePrefixAtSelection(b, s, e, "1. ", "列表项"))
                      }
                    >
                      1.
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="分隔线 ---"
                      onClick={() => applyInsert(insertHorizontalRuleAtSelection)}
                    >
                      ─
                    </button>
                  </div>
                  <div className="notes-insert-group" role="group" aria-label="链接与图片">
                    <span className="notes-insert-group-label">链接</span>
                    <button type="button" className="notes-insert-btn" title="插入链接" onClick={insertLink}>
                      链接
                    </button>
                    <button
                      type="button"
                      className="notes-insert-btn"
                      title="插入图片 Markdown；截图请 Ctrl+V"
                      onClick={insertImageLink}
                    >
                      图片
                    </button>
                  </div>
                  <div
                    className="notes-insert-group notes-insert-group--subjects"
                    role="group"
                    aria-label="科目块"
                  >
                    <span className="notes-insert-group-label">科目块</span>
                    <div className="notes-subject-picks">
                      {NOTE_SUBJECT_BLOCK_PRESETS.map((preset) => (
                        <button
                          key={preset.title}
                          type="button"
                          className="notes-subject-pick"
                          data-icon={preset.icon}
                          title={`插入 ## 📌 ${preset.title}`}
                          onClick={() => insertSubjectBlock(preset.title)}
                        >
                          <span className="notes-subject-pick-icon" aria-hidden="true">
                            <NoteSubjectIcon iconKey={preset.icon} />
                          </span>
                          <span className="notes-subject-pick-label">{preset.short}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="notes-subject-pick notes-subject-pick--custom"
                        data-icon="custom"
                        title="自定义科目块标题"
                        onClick={() => {
                          const t = window.prompt("自定义块标题（将写入 ## 📌 …）", "");
                          if (t && t.trim()) insertSubjectBlock(t.trim());
                        }}
                      >
                        <span className="notes-subject-pick-icon" aria-hidden="true">
                          <NoteSubjectIcon iconKey="custom" />
                        </span>
                        <span className="notes-subject-pick-label">自定义</span>
                      </button>
                    </div>
                  </div>
                  <label className="notes-insert-field">
                    <span>代码块</span>
                    <select
                      className="notes-insert-select"
                      defaultValue=""
                      key={`code-${state.activeId}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = "";
                        if (v) insertCodeBlock(v);
                      }}
                    >
                      <option value="">语言…</option>
                      {NOTE_CODE_FENCE_LANGS.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="notes-editor-split" ref={notesEditorSplitRef}>
                  <div
                    className="notes-editor-pane"
                    style={{ flex: `${notesEditorRatio} 1 0%` }}
                  >
                    <textarea
                      key={state.activeId}
                      ref={textareaRef}
                      className="notes-textarea notes-textarea--in-split"
                      value={active.body ?? ""}
                      onChange={(e) => handleNoteEditorChange(e.target.value)}
                      onSelect={handleNoteEditorSelect}
                      onKeyUp={handleNoteEditorSelect}
                      onClick={handleNoteEditorSelect}
                      onKeyDown={handleNoteEditorKeyDown}
                      onPaste={handleNoteImagePaste}
                      placeholder={
                        kbOllama && tabCompleteOn
                          ? "支持 Markdown。Ollama 已连接：停笔自动预读，Tab 采纳续写。"
                          : "支持 Markdown。左侧编辑，右侧实时预览；桌面版可粘贴截图。"
                      }
                      spellCheck={false}
                    />
                    {(completeHint || completeSuggestion) && tabCompleteOn && kbOllama ? (
                      <div className="notes-complete-bar" aria-live="polite">
                        {completeBusy ? (
                          <span className="notes-complete-status">{completeHint || "续写中…"}</span>
                        ) : completeSuggestion ? (
                          <>
                            <span className="notes-complete-label">建议续写</span>
                            <span className="notes-complete-ghost">{completeSuggestion}</span>
                            <span className="notes-complete-status">{completeHint}</span>
                          </>
                        ) : (
                          <span className="notes-complete-status">{completeHint}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="layout-gutter layout-gutter-split"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="调整编辑区与预览比例"
                    onMouseDown={startNotesOutlineResize}
                  />
                  <aside
                    className="notes-split-preview"
                    style={{ flex: `${1 - notesEditorRatio} 1 0%` }}
                    aria-label="Markdown 预览"
                  >
                    <div className="notes-split-preview-h">预览</div>
                    <div
                      className="markdown notes-preview-pane notes-preview-pane--split"
                      dangerouslySetInnerHTML={{ __html: splitPreviewHtml }}
                    />
                  </aside>
                </div>
              </>
            ) : (
              <p className="hint">在「知识树」中选笔记，或切回「编辑」。</p>
            )}
          </div>
        </main>
        </div>
      </div>
    </div>
  );
}
