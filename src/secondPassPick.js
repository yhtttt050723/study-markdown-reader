import { isSecondPassPlanFile } from "./markdownQuiz.js";

/** 二刷计划文件名常见前缀日期，如 2026-05-13.md 或 2026-05-13-xxx-二刷.md */
export function extractLeadingIsoDateFromName(name) {
  const m = String(name || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * 在已列出的文件中选「最新」二刷计划：路径含「二刷计划」的 .md，优先文件名开头日期降序。
 * @param {Array<{ name: string, relativePath: string, fullPath: string }>} files
 */
export function pickLatestSecondPassPlan(files) {
  const list = (files || []).filter(isSecondPassPlanFile);
  if (!list.length) return null;
  const scored = list.map((f) => ({
    f,
    d: extractLeadingIsoDateFromName(f.name),
  }));
  scored.sort((a, b) => {
    if (a.d && b.d) return b.d.localeCompare(a.d);
    if (a.d && !b.d) return -1;
    if (!a.d && b.d) return 1;
    return b.f.relativePath.localeCompare(a.f.relativePath, "zh-CN");
  });
  return scored[0].f;
}
