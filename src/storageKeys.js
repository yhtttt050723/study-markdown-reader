/** 本应用 localStorage 键统一前缀 `smr-`（见 .cursor/rules） */

export const LS_PLAN_PATH_DONE = "smr-plan-path-done";
export const LS_STUDY_PROGRESS = "smr-study-progress";
export const LS_QUIZ_LOG = "smr-quiz-log";
export const LS_SECOND_PLAN_FOCUS = "smr-quiz-second-plan-focus";
export const LS_QUIZ_FILE_ONLY = "smr-quiz-file-only";
export const LS_SIDEBAR_W = "smr-sidebar-w";
export const LS_SPLIT_RATIO = "smr-split-ratio";

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
