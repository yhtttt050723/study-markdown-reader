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

function normalizeNote(n) {
  if (!n || typeof n.id !== "string") return null;
  const title = typeof n.title === "string" ? n.title.slice(0, 200) : "未命名";
  const body =
    typeof n.body === "string" ? n.body.slice(0, MAX_BODY) : "";
  const updatedAt =
    typeof n.updatedAt === "string" ? n.updatedAt : new Date().toISOString();
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
    id: n.id,
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
    const activeId =
      typeof o.activeId === "string" && notes.some((x) => x.id === o.activeId)
        ? o.activeId
        : notes[0].id;
    return { notes, activeId };
  } catch {
    const s = defaultQuickNotesState();
    s.activeId = s.notes[0]?.id ?? null;
    return s;
  }
}

export function writeQuickNotesState(state) {
  // 列表为「新在前」：保留前 MAX_NOTES 条即保留最新；slice(-N) 会误删最新笔记
  const notes =
    state.notes.length > MAX_NOTES
      ? state.notes.slice(0, MAX_NOTES)
      : state.notes;
  let activeId = state.activeId;
  if (activeId && !notes.some((n) => n.id === activeId)) {
    activeId = notes[0]?.id ?? null;
  }
  trySetLocalStorage(LS_QUICK_NOTES, JSON.stringify({ notes, activeId }));
}
