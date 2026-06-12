import { readQuizLog } from "./quizLogAnalytics.js";

/** 稳定笔记 id：同一科目反复同步会覆盖更新同一页（科目名 URI 编码，避免哈希碰撞） */
export function subjectWrongNoteId(subject) {
  const s = (subject || "未填科目").trim() || "未填科目";
  try {
    return `smr-qw-${encodeURIComponent(s)}`;
  } catch {
    return "smr-qw-fallback";
  }
}

/**
 * @param {string} subject
 * @returns {{ tagL1: string, tagL2: string }}
 */
export function classifyQuizSubjectTags(subject) {
  const s = (subject || "").trim();
  if (!s || s === "未填科目") {
    return { tagL1: "错题集", tagL2: "未填科目" };
  }
  if (/概率|高数|线代|微积分|高等数学|数理统计|线性代数/i.test(s)) {
    return { tagL1: "数学", tagL2: s };
  }
  if (/计组|操作系统|数据结构|计算机网络|408|CO\b|DS\b|CN\b/i.test(s)) {
    return { tagL1: "408", tagL2: s };
  }
  if (/英语|English/i.test(s)) return { tagL1: "英语", tagL2: s };
  if (/政治/i.test(s)) return { tagL1: "政治", tagL2: s };
  return { tagL1: "错题集", tagL2: s };
}

/** @param {string} absPath Windows 或绝对路径 */
export function imagePathToFileMarkdown(absPath) {
  const raw = (absPath || "").trim();
  if (!raw) return "";
  const slash = raw.replace(/\\/g, "/");
  const url = /^[a-zA-Z]:/.test(slash)
    ? `file:///${slash}`
    : `file:///${slash.replace(/^\/+/, "")}`;
  return `\n![题目截图](${url})\n`;
}

/**
 * @param {import("./quizLogAnalytics.js").QuizLogEntry[]} entries
 * @returns {Map<string, import("./quizLogAnalytics.js").QuizLogEntry[]>}
 */
export function groupWrongEntriesBySubject(entries) {
  const wrong = (entries || []).filter((e) => e && e.correct === false);
  const map = new Map();
  for (const e of wrong) {
    const subj = (e.subject || "").trim() || "未填科目";
    if (!map.has(subj)) map.set(subj, []);
    map.get(subj).push(e);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const ta = a.at || "";
      const tb = b.at || "";
      return tb.localeCompare(ta);
    });
  }
  return map;
}

/**
 * @param {string} subject
 * @param {import("./quizLogAnalytics.js").QuizLogEntry[]} sortedWrong
 */
export function buildSubjectWrongNoteContent(subject, sortedWrong) {
  const { tagL1, tagL2 } = classifyQuizSubjectTags(subject);
  const title = `错题 · ${subject}`;
  const when = new Date().toLocaleString("zh-CN");
  const lines = [
    `# ${title}`,
    "",
    `> 由 **smr-quiz-log** 同步（仅包含随机刷题中标记为 **做错** 的记录）。同步时间：${when}`,
    "",
    "---",
    "",
  ];

  for (const e of sortedWrong) {
    const at = e.at ? new Date(e.at).toLocaleString("zh-CN") : "—";
    const kindLabel = e.kind === "secondpass" ? "二刷计划" : "错题本";
    const ti = String(e.title || "未命名").replace(/\s+/g, " ").trim();
    lines.push(`### ${at} · ${kindLabel}`);
    lines.push(`- **题目**：${ti}`);
    lines.push(
      `- **用时**：${typeof e.seconds === "number" ? `${e.seconds}s` : "—"} · **结果**：做错`
    );
    lines.push(`- **文件**：\`${String(e.fileLabel || "—").replace(/`/g, "'")}\``);
    lines.push(`- **文件夹**：${e.folderTag || "—"}`);
    const img = (e.imagePath || "").trim();
    if (img) {
      lines.push(`- **题目图片**：\`${img.replace(/`/g, "'")}\``);
      lines.push(imagePathToFileMarkdown(img));
    }
    lines.push("");
  }

  const body = lines.join("\n");
  const n = sortedWrong.length;
  const importance = Math.min(5, 3 + Math.min(2, Math.floor(n / 8)));
  const keywords = Array.from(
    new Set([
      tagL2,
      "错题",
      "刷题日志",
      sortedWrong.some((x) => x.kind === "secondpass") ? "二刷" : "",
      sortedWrong.some((x) => x.kind === "wrongbook") ? "错题本" : "",
    ].filter(Boolean))
  );

  return { title, body, tagL1, tagL2, importance, keywords };
}

/**
 * 将刷题日志中的做错记录整理为多页笔记（按科目合并）。
 * @returns {{ state: { notes: unknown[], activeId: string | null }, message: string }}
 */
export function mergeQuizWrongIntoQuickNotes(prev) {
  const entries = readQuizLog();
  const grouped = groupWrongEntriesBySubject(entries);
  const subjects = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));

  if (subjects.length === 0) {
    return {
      state: prev,
      message:
        "暂无做错记录可导入：请先在「Markdown 浏览器」打开含错题的文件夹，使用随机刷题并提交几次 **做错** 的结果。",
    };
  }

  const now = new Date().toISOString();
  let notes = prev.notes.slice();
  const touchedIds = [];

  for (const subject of subjects) {
    const list = grouped.get(subject);
    const id = subjectWrongNoteId(subject);
    const { title, body, tagL1, tagL2, importance, keywords } =
      buildSubjectWrongNoteContent(subject, list);

    const idx = notes.findIndex((n) => n.id === id);
    const note = {
      id,
      title,
      body,
      updatedAt: now,
      tagL1,
      tagL2,
      importance,
      keywords,
      vectorCluster: "",
    };

    if (idx >= 0) {
      notes[idx] = note;
    } else {
      notes = [note, ...notes];
    }
    touchedIds.push(id);
  }

  const activeId = touchedIds.includes(prev.activeId)
    ? prev.activeId
    : touchedIds[0] || prev.activeId;

  return {
    state: { notes, activeId },
    message: `已从刷题日志导入 / 更新 ${subjects.length} 个科目的错题笔记（可做标签微调后再同步知识库）。`,
  };
}
