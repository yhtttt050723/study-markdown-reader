import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { localImageProtocolUrlFromRaw } from "./markdownQuiz.js";
import {
  newNoteId,
  readQuickNotesState,
  writeQuickNotesState,
} from "./quickNotes.js";
import { WorkspaceBackBar } from "./WorkspaceChrome.jsx";
import { NoteKnowledgeMap, buildTreeFromNotes } from "./NoteKnowledgeMap.jsx";
import {
  LS_NOTES_EDITOR_RATIO,
  readStoredNumber,
  trySetLocalStorage,
} from "./storageKeys.js";
import { mergeQuizWrongIntoQuickNotes } from "./quizNotesSync.js";
import {
  extractH2Outline,
  insertCodeFenceAtSelection,
  insertSubjectBlockAtSelection,
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

  const [notesEditorRatio, setNotesEditorRatio] = useState(() =>
    readStoredNumber(LS_NOTES_EDITOR_RATIO, 0.72, 0.38, 0.9)
  );

  const [state, setState] = useState(() => readQuickNotesState());
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState("edit");
  const [kbOk, setKbOk] = useState(null);
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
      setKbOk(Boolean(h.ok && h.pg));
      setKbEmbed(Boolean(h.embedding));
      setKbOllama(Boolean(h.ollama));
      setKbOllamaModel(typeof h.ollamaModel === "string" ? h.ollamaModel : "");
      if (h.ok && h.pg) {
        const t = await kbGetTree();
        setTreeRemote(t.tree || []);
      } else {
        setTreeRemote(null);
      }
    } catch {
      setKbOk(false);
      setKbEmbed(false);
      setKbOllama(false);
      setKbOllamaModel("");
      setTreeRemote(null);
    }
  }, []);

  useEffect(() => {
    refreshKbMeta();
  }, [refreshKbMeta]);

  const active = useMemo(
    () => state.notes.find((n) => n.id === state.activeId) ?? null,
    [state.notes, state.activeId]
  );

  const treeData = useMemo(() => {
    if (treeRemote && treeRemote.length > 0) return treeRemote;
    return buildTreeFromNotes(state.notes);
  }, [treeRemote, state.notes]);

  const filteredNotes = useMemo(() => {
    let list = state.notes.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (filterL1) list = list.filter((n) => (n.tagL1 || "未分类") === filterL1);
    if (filterL2) list = list.filter((n) => (n.tagL2 || "未分类") === filterL2);
    return list;
  }, [state.notes, filterL1, filterL2]);

  const patchActive = useCallback((patch) => {
    setState((prev) => {
      const now = new Date().toISOString();
      const notes = prev.notes.map((n) =>
        n.id === prev.activeId ? { ...n, ...patch, updatedAt: now } : n
      );
      return { ...prev, notes };
    });
  }, []);

  const updateActiveBody = useCallback((body) => {
    setState((prev) => {
      const now = new Date().toISOString();
      const notes = prev.notes.map((n) =>
        n.id === prev.activeId
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

  const h2Outline = useMemo(
    () => extractH2Outline(active?.body ?? ""),
    [active?.body]
  );

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
      const { nextBody, caret } = insertSubjectBlockAtSelection(body, start, end, title);
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

  const jumpToOutlineHeading = useCallback(
    (charStart) => {
      if (!active || preview || panel !== "edit") return;
      const ta = textareaRef.current;
      if (!ta) return;
      const c = Math.min(Math.max(0, charStart), ta.value.length);
      ta.focus();
      requestAnimationFrame(() => {
        ta.setSelectionRange(c, c);
        try {
          const line = ta.value.slice(0, c).split(/\r?\n/).length;
          const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
          ta.scrollTop = Math.max(0, (line - 3) * lh);
        } catch {
          /* ignore */
        }
      });
    },
    [active, preview, panel]
  );

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
      const mapped = notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        updatedAt: n.updatedAt || new Date().toISOString(),
        tagL1: n.tagL1 || "未分类",
        tagL2: n.tagL2 || "未分类",
        importance: n.importance ?? 3,
        keywords: n.keywords || [],
        vectorCluster: n.vectorCluster || "",
      }));
      setState({
        notes: mapped,
        activeId: mapped[0]?.id ?? null,
      });
      setRefineHint({ ok: "已从知识库拉取。" });
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

  return (
    <div className="notes-workspace">
      <WorkspaceBackBar onBack={onBack} title="学习笔记 · 知识库">
        <div className="notes-kb-status">
          {kbOk === null && <span className="notes-kb-pill">知识库检测中…</span>}
          {kbOk === false && (
            <span className="notes-kb-pill notes-kb-pill--off">知识库离线（仅本地 smr-quick-notes）</span>
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
                setState((p) => ({ ...p, activeId: id }));
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
                  className={n.id === state.activeId ? "active" : ""}
                  onClick={() => {
                    setState((p) => ({ ...p, activeId: n.id }));
                    setRefineHint(null);
                  }}
                >
                  <span className="notes-item-title">{n.title}</span>
                  <span className="notes-item-tags">
                    {(n.tagL1 || "未分类")} › {(n.tagL2 || "未分类")}
                  </span>
                  <span className="notes-item-time">
                    {n.updatedAt.slice(0, 16).replace("T", " ")}
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
              <p className="hint">暂无笔记，点击「新建」。</p>
            ) : panel === "edit" && preview ? (
              <div
                className="markdown notes-preview-pane"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(active.body || ""),
                }}
              />
            ) : panel === "edit" ? (
              <>
                <div className="notes-insert-toolbar" aria-label="插入 Markdown 片段">
                  <span className="notes-insert-toolbar-title">方案 A · 分块</span>
                  <span className="notes-insert-hint">
                    以 <code>##</code> 为块界；插入 <code>## 📌 科目</code> 与代码围栏。中间竖条可拖动调整编辑区与大纲比例（记在{" "}
                    <code>smr-notes-editor-ratio</code>）。桌面版可在编辑区 <strong>Ctrl+V</strong> 粘贴截图。
                  </span>
                  <label className="notes-insert-field">
                    <span>科目块</span>
                    <select
                      className="notes-insert-select"
                      defaultValue=""
                      key={`subj-${state.activeId}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = "";
                        if (!v) return;
                        if (v === "__custom__") {
                          const t = window.prompt("自定义块标题（将写入 ## 📌 …）", "");
                          if (t && t.trim()) insertSubjectBlock(t.trim());
                          return;
                        }
                        insertSubjectBlock(v);
                      }}
                    >
                      <option value="">选择…</option>
                      {NOTE_SUBJECT_BLOCK_PRESETS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__custom__">自定义…</option>
                    </select>
                  </label>
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
                      ref={textareaRef}
                      className="notes-textarea notes-textarea--in-split"
                      value={active.body ?? ""}
                      onChange={(e) => updateActiveBody(e.target.value)}
                      onPaste={handleNoteImagePaste}
                      placeholder={
                        "支持 Markdown。用「科目块」插入 ## 📌 标题；拖中间竖条调比例；右侧大纲可点击跳转；桌面版可粘贴截图。"
                      }
                      spellCheck={false}
                    />
                  </div>
                  <div
                    className="layout-gutter layout-gutter-split"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="调整编辑区与块大纲比例"
                    onMouseDown={startNotesOutlineResize}
                  />
                  <aside
                    className="notes-block-outline"
                    style={{ flex: `${1 - notesEditorRatio} 1 0%` }}
                    aria-label="二级标题大纲"
                  >
                    <div className="notes-block-outline-h">块大纲</div>
                    {h2Outline.length === 0 ? (
                      <p className="notes-block-outline-empty">暂无 <code>##</code> 标题</p>
                    ) : (
                      <ul className="notes-block-outline-list">
                        {h2Outline.map((h) => (
                          <li key={`${h.charStart}-${h.title}`}>
                            <button
                              type="button"
                              className="notes-block-outline-btn"
                              onClick={() => jumpToOutlineHeading(h.charStart)}
                              title={`跳转到：${h.title}`}
                            >
                              {h.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
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
