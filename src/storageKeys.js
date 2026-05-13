/** 本应用 localStorage 键统一前缀 `smr-`（见 .cursor/rules） */

export const LS_PLAN_PATH_DONE = "smr-plan-path-done";
export const LS_PROGRESS_SNAPSHOTS = "smr-progress-snapshots";
export const LS_STUDY_PROGRESS = "smr-study-progress";
export const LS_QUIZ_LOG = "smr-quiz-log";
export const LS_SECOND_PLAN_FOCUS = "smr-quiz-second-plan-focus";
export const LS_QUIZ_FILE_ONLY = "smr-quiz-file-only";
export const LS_SIDEBAR_W = "smr-sidebar-w";
export const LS_SPLIT_RATIO = "smr-split-ratio";
/** 学习笔记：编辑区 vs 块大纲 横向比例（左侧编辑区占比 0–1） */
export const LS_NOTES_EDITOR_RATIO = "smr-notes-editor-ratio";
export const LS_FINANCE_STATE = "smr-finance-state";
/** 应用区块：home | reader | notes | progress */
export const LS_APP_SECTION = "smr-app-section";
/** Electron 上次打开的文件夹绝对路径（浏览器模式不使用） */
export const LS_FOLDER_PATH = "smr-folder-path";
/** 速记笔记（与文件夹无关） */
export const LS_QUICK_NOTES = "smr-quick-notes";

export function readStoredNumber(key, fallback, min, max) {
  try {
    const v = Number(localStorage.getItem(key));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  } catch {
    return fallback;
  }
}

export function trySetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function tryGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
