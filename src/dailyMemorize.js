/** 文件名含「要背」的 .md / .mdc，用于首页「每日要背」自动选取 */

export function isDailyMemorizeMarkdown(entry) {
  const n = entry?.name || "";
  const lower = n.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".mdc")) return false;
  return n.includes("要背");
}

/** 从文件名末尾取 ISO 日期（如 xxx-要背-2026-05-13.md） */
export function extractTrailingIsoDateFromName(name) {
  const m = String(name || "").match(/(\d{4}-\d{2}-\d{2})\.(md|mdc)$/i);
  return m ? m[1] : null;
}

/**
 * 在已列出的文件中选「最新」每日要背：优先文件名末尾日期降序，无日期则按路径逆序稳定排序。
 * @param {Array<{ name: string, relativePath: string, fullPath: string }>} files
 */
export function pickLatestDailyMemorize(files) {
  const list = (files || []).filter(isDailyMemorizeMarkdown);
  if (!list.length) return null;
  const scored = list.map((f) => ({
    f,
    d: extractTrailingIsoDateFromName(f.name),
  }));
  scored.sort((a, b) => {
    if (a.d && b.d) return b.d.localeCompare(a.d);
    if (a.d && !b.d) return -1;
    if (!a.d && b.d) return 1;
    return b.f.relativePath.localeCompare(a.f.relativePath, "zh-CN");
  });
  return scored[0].f;
}
