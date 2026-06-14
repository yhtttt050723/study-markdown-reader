import { LS_QUICK_NOTES, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

const MAX_NOTES = 200;
const MAX_BODY = 200_000;

export function newNoteId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultQuickNotesState() {
  return {
    notes: [
      {
        id: newNoteId(),
        title: "欢迎",
        body: "在此写速记，支持 Markdown。数据保存在本机 **smr-quick-notes**；可选同步到 **PostgreSQL + pgvector**（见 `kb-server`）。\n\n**分块（方案 A）**：用工具栏插入 **科目块**（生成 `## 📌 …`），或自行写任意 `##` 标题；右侧 **块大纲** 可点击跳转。\n\n用 Cursor Skill **note-knowledge-tagging** 先打一级/二级标签与重点，再点「向量二次划分」细化。",
        updatedAt: new Date().toISOString(),
        tagL1: "说明",
        tagL2: "入门",
        importance: 2,
        keywords: ["知识库", "Skill", "pgvector"],
        vectorCluster: "",
      },
    ],
    activeId: null,
  };
}

export function coerceUpdatedAt(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

export function normalizeNote(n) {
  if (!n || n.id == null || n.id === "") return null;
  const id = String(n.id);
  const title = typeof n.title === "string" ? n.title.slice(0, 200) : "未命名";
  const body =
    typeof n.body === "string" ? n.body.slice(0, MAX_BODY) : "";
  const updatedAt = coerceUpdatedAt(n.updatedAt);
  const tagL1 =
    typeof n.tagL1 === "string" && n.tagL1.trim() ? n.tagL1.trim() : "未分类";
  const tagL2 =
    typeof n.tagL2 === "string" && n.tagL2.trim() ? n.tagL2.trim() : "未分类";
  const imp = Number(n.importance);
  const importance = Number.isFinite(imp) ? Math.min(5, Math.max(1, imp)) : 3;
  const keywords = Array.isArray(n.keywords)
    ? n.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 40)
    : [];
  const vectorCluster =
    typeof n.vectorCluster === "string" ? n.vectorCluster.slice(0, 500) : "";
  return {
    id,
    title,
    body,
    updatedAt,
    tagL1,
    tagL2,
    importance,
    keywords,
    vectorCluster,
  };
}

export function readQuickNotesState() {
  const raw = tryGetLocalStorage(LS_QUICK_NOTES);
  if (!raw) {
    const s = defaultQuickNotesState();
    s.activeId = s.notes[0]?.id ?? null;
    return s;
  }
  try {
    const o = JSON.parse(raw);
    const notes = Array.isArray(o.notes)
      ? o.notes.map(normalizeNote).filter(Boolean)
      : [];
    if (notes.length === 0) {
      const s = defaultQuickNotesState();
      s.activeId = s.notes[0]?.id ?? null;
      return s;
    }
    const rawAid = o.activeId != null ? String(o.activeId) : null;
    const activeId =
      rawAid && notes.some((x) => x.id === rawAid) ? rawAid : notes[0].id;
    return { notes, activeId };
  } catch {
    const s = defaultQuickNotesState();
    s.activeId = s.notes[0]?.id ?? null;
    return s;
  }
}

/** 统一 id / activeId / 时间字段，避免知识库拉取后 id 类型不一致导致无法编辑 */
export function normalizeNotesState(state) {
  const notes = (Array.isArray(state?.notes) ? state.notes : [])
    .map((n) => normalizeNote(n))
    .filter(Boolean);
  let activeId = state?.activeId != null ? String(state.activeId) : null;
  if (activeId && !notes.some((n) => n.id === activeId)) {
    activeId = notes[0]?.id ?? null;
  } else if (!activeId && notes[0]) {
    activeId = notes[0].id;
  }
  return { notes, activeId };
}

export function writeQuickNotesState(state) {
  const { notes: normalized, activeId } = normalizeNotesState(state);
  // 列表为「新在前」：保留前 MAX_NOTES 条即保留最新；slice(-N) 会误删最新笔记
  const notes =
    normalized.length > MAX_NOTES ? normalized.slice(0, MAX_NOTES) : normalized;
  let activeIdFinal = activeId;
  if (activeIdFinal && !notes.some((n) => n.id === activeIdFinal)) {
    activeIdFinal = notes[0]?.id ?? null;
  }
  trySetLocalStorage(
    LS_QUICK_NOTES,
    JSON.stringify({ notes, activeId: activeIdFinal }),
  );
  try {
    window.dispatchEvent(new CustomEvent("smr-quick-notes-changed"));
  } catch {
    /* non-browser */
  }
}
