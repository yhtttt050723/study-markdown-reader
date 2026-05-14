/**
 * 解析「学习视频进度」目录下各 BV 详情 .md 中的分 P 勾选行。
 * 行格式（与 MDC 生成一致）：`- [ ] **P12**（3139s）— …` 或半角括号。
 *
 * @param {string} md
 * @returns {{ totalParts: number, doneParts: number, totalSeconds: number, doneSeconds: number } | null}
 */
export function parseVideoDetailChecklist(md) {
  if (typeof md !== "string" || !md.trim()) return null;
  const lines = md.split(/\r?\n/);
  let totalSeconds = 0;
  let doneSeconds = 0;
  let totalParts = 0;
  let doneParts = 0;
  const re = /^-\s*\[([^\]]*)\]\s+\*\*P(\d+)\*\*\s*[（(](\d+)s[）)]/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const bracket = (m[1] || "").trim();
    const checked = /x/i.test(bracket);
    const sec = Math.max(0, Math.floor(Number(m[3]) || 0));
    totalParts += 1;
    totalSeconds += sec;
    if (checked) {
      doneParts += 1;
      doneSeconds += sec;
    }
  }
  if (totalParts === 0) return null;
  return { totalParts, doneParts, totalSeconds, doneSeconds };
}
