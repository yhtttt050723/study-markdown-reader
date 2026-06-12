import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_STUDY_PROGRESS, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** Markdown 中 JSON 代码块语言标记（与择校等一致：专用 fenced block） */
export const STUDY_PROGRESS_FENCE = "smr-progress";

/**
 * 是否为「学习进度」数据文件：文件名或相对路径包含「学习进度」。
 * @param {{ name?: string, relativePath?: string } | null} file
 */
export function isStudyProgressFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("学习进度") || rp.includes("学习进度");
}

/**
 * 在已打开的文件夹根目录生成默认「学习进度.md」路径（Electron）。
 * @param {string} folderPath
 */
export function resolveStudyProgressDefaultPath(folderPath) {
  if (!folderPath || typeof folderPath !== "string") return null;
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}周期记录${sep}学习进度.md`;
}

/** 必考词单元数 */
export const ENGLISH_MUST_UNITS = 26;
/** 基础词单元数 */
export const ENGLISH_BASIC_UNITS = 29;

/** 无科目目录文件时用于 clamp / 迁移的旧版章节数（与仓库内 Math.mdc / 408.mdc 一致） */
export const MATH_CHAPTER_DEFAULT_MAX = {
  高数: 12,
  线代: 6,
  概率论: 8,
};

export const CS408_CHAPTER_DEFAULT_MAX = {
  机组: 7,
  数据结构: 8,
  计网: 6,
  操作系统: 5,
};

/**
 * @typedef {{
 *   basicThrough: number,
 *   strengthenThrough: number,
 *   book660Through?: number,
 *   book660Total?: number,
 *   book660Caption?: string,
 * }} MathSubjectProgress
 * @typedef {{ through: number }} Cs408SubjectProgress
 */

/** 《660》高数分册默认总题数（与 `周期记录/进度规划看板.md` 一致；线代/概率开做后可写 `book660Total`） */
export const BOOK660_DEFAULT_TOTAL_CALC = 360;

/**
 * basicThrough / strengthenThrough：按红书基础篇 / 严选题 **已过章节数**（0～目录章数，与章节条目对齐）。
 * book660Through / book660Total：《660》当前分册已做题数 / 本分册总题数（高数默认总题数 360；`book660Total: 0` 表示不在看板显示该科 660 条）。
 * book660Caption：看板「《660》」条下说明文字（可选，如已过至章节）。
 * cs408.through：408 单科基础已过章节数。
 */
export const DEFAULT_STUDY_PROGRESS = {
  math1: {
    高数: {
      basicThrough: 12,
      strengthenThrough: 12,
      book660Through: 80,
      book660Total: BOOK660_DEFAULT_TOTAL_CALC,
      book660Caption: "已过至：第六章 定积分应用（第 80 题）",
    },
    线代: { basicThrough: 4, strengthenThrough: 3, book660Through: 0, book660Total: 0 },
    概率论: { basicThrough: 3, strengthenThrough: 2, book660Through: 0, book660Total: 0 },
  },
  math2: {
    高数: {
      basicThrough: 12,
      strengthenThrough: 12,
      book660Through: 80,
      book660Total: BOOK660_DEFAULT_TOTAL_CALC,
      book660Caption: "已过至：第六章 定积分应用（第 80 题）",
    },
    线代: { basicThrough: 4, strengthenThrough: 3, book660Through: 0, book660Total: 0 },
  },
  cs408: {
    数据结构: { through: 7 },
    机组: { through: 6 },
    计网: { through: 6 },
    操作系统: { through: 5 },
  },
  english: {
    mustWords: { round1Unit: 0, round2Unit: 0 },
    basicWords: { round1Unit: 0, round2Unit: 0 },
  },
};

function clampUnit(n, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.min(max, Math.max(0, x));
}

function clampThroughValue(v, maxChapters) {
  const m = Math.max(0, Math.floor(maxChapters));
  if (m <= 0) return Math.max(0, Math.floor(Number(v) || 0));
  return clampUnit(v, m);
}

/**
 * @param {string} key
 * @param {import('./studyCatalog.js').CatalogChapter[]|undefined} chapters
 */
function maxChForMath(key, chapters) {
  if (chapters && chapters.length > 0) return chapters.length;
  return MATH_CHAPTER_DEFAULT_MAX[key] ?? 12;
}

/**
 * @param {string} key
 * @param {import('./studyCatalog.js').CatalogChapter[]|undefined} chapters
 */
function maxCh408(key, chapters) {
  if (chapters && chapters.length > 0) return chapters.length;
  return CS408_CHAPTER_DEFAULT_MAX[key] ?? 8;
}

/**
 * @param {string} key 高数 | 线代 | 概率论
 * @param {Record<string, unknown>} pr
 */
function normalizeBook660(key, pr) {
  const explicitTotal = Math.floor(Number(pr.book660Total));
  const defaultTotal = key === "高数" ? BOOK660_DEFAULT_TOTAL_CALC : 0;
  const book660Total =
    Number.isFinite(explicitTotal) && explicitTotal > 0 ? explicitTotal : defaultTotal;
  const throughRaw = Math.floor(Number(pr.book660Through));
  const book660Through =
    book660Total > 0
      ? clampUnit(Number.isFinite(throughRaw) ? throughRaw : 0, book660Total)
      : 0;
  const cap = pr.book660Caption;
  const book660Caption = typeof cap === "string" ? cap.trim() : "";
  return { book660Total, book660Through, book660Caption };
}

function normalizeMathRow(key, row, chapters) {
  const max = maxChForMath(key, chapters);
  const pr = row && typeof row === "object" ? row : {};
  const b660 = normalizeBook660(key, pr);
  const hasThrough =
    typeof pr.basicThrough === "number" || typeof pr.strengthenThrough === "number";
  if (hasThrough) {
    return {
      basicThrough: clampThroughValue(pr.basicThrough ?? 0, max),
      strengthenThrough: clampThroughValue(pr.strengthenThrough ?? 0, max),
      ...b660,
    };
  }
  if ("basicPct" in pr || "strengthenPct" in pr) {
    const n = max;
    return {
      basicThrough: n ? Math.round(((Number(pr.basicPct) || 0) / 100) * n) : 0,
      strengthenThrough: n ? Math.round(((Number(pr.strengthenPct) || 0) / 100) * n) : 0,
      ...b660,
    };
  }
  return {
    basicThrough: clampThroughValue(pr.basicThrough ?? 0, max),
    strengthenThrough: clampThroughValue(pr.strengthenThrough ?? 0, max),
    ...b660,
  };
}

function normalize408Row(key, row, chapters) {
  const max = maxCh408(key, chapters);
  const pr = row && typeof row === "object" ? row : {};
  if (typeof pr.through === "number") {
    return { through: clampThroughValue(pr.through, max) };
  }
  if ("basicPct" in pr || "strengthenPct" in pr) {
    const n = max;
    const pct = Number(pr.basicPct ?? pr.strengthenPct ?? 0);
    return { through: n ? Math.round((pct / 100) * n) : 0 };
  }
  return { through: clampThroughValue(pr.through ?? 0, max) };
}

function mergeMathMap(base, patch, catalogSlice) {
  const out = {};
  for (const key of Object.keys(base)) {
    const ch = catalogSlice?.[key];
    const rowPatch =
      patch && typeof patch[key] === "object" && patch[key] != null
        ? { ...base[key], ...patch[key] }
        : base[key];
    out[key] = normalizeMathRow(key, rowPatch, ch);
  }
  return out;
}

function mergeCs408Map(base, patch, catalogSlice) {
  const out = {};
  for (const key of Object.keys(base)) {
    const ch = catalogSlice?.[key];
    const rowPatch =
      patch && typeof patch[key] === "object" && patch[key] != null
        ? { ...base[key], ...patch[key] }
        : base[key];
    out[key] = normalize408Row(key, rowPatch, ch);
  }
  return out;
}

/**
 * 合并进度 JSON；可选传入已解析的科目目录用于章节 clamp。
 * @param {typeof DEFAULT_STUDY_PROGRESS} base
 * @param {object} patch
 * @param {{ math?: object, cs408?: object } | undefined} catalog
 */
export function mergeStudyProgressData(base, patch, catalog) {
  if (patch == null || typeof patch !== "object") return base;
  const mathCat = catalog?.math;
  const csCat = catalog?.cs408;
  return {
    math1: mergeMathMap(base.math1, patch.math1, mathCat),
    math2: mergeMathMap(base.math2, patch.math2, mathCat),
    cs408: mergeCs408Map(base.cs408, patch.cs408, csCat),
    english: {
      mustWords: {
        round1Unit: clampUnit(
          patch?.english?.mustWords?.round1Unit ?? base.english.mustWords.round1Unit,
          ENGLISH_MUST_UNITS
        ),
        round2Unit: clampUnit(
          patch?.english?.mustWords?.round2Unit ?? base.english.mustWords.round2Unit,
          ENGLISH_MUST_UNITS
        ),
      },
      basicWords: {
        round1Unit: clampUnit(
          patch?.english?.basicWords?.round1Unit ?? base.english.basicWords.round1Unit,
          ENGLISH_BASIC_UNITS
        ),
        round2Unit: clampUnit(
          patch?.english?.basicWords?.round2Unit ?? base.english.basicWords.round2Unit,
          ENGLISH_BASIC_UNITS
        ),
      },
    },
  };
}

export function readStudyProgress() {
  try {
    const raw = tryGetLocalStorage(LS_STUDY_PROGRESS);
    if (!raw) {
      return structuredClone(DEFAULT_STUDY_PROGRESS);
    }
    const parsed = JSON.parse(raw);
    return mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), parsed);
  } catch {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
}

export function writeStudyProgress(data) {
  try {
    trySetLocalStorage(LS_STUDY_PROGRESS, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} md
 * @param {{ math?: object, cs408?: object } | undefined} catalog
 */
export function parseStudyProgressFromMarkdown(md, catalog) {
  const body = md || "";
  const re = new RegExp(
    "```" + STUDY_PROGRESS_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```",
    "m"
  );
  const m = body.match(re);
  if (!m) {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
  try {
    const parsed = JSON.parse(m[1].trim());
    return mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), parsed, catalog);
  } catch {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
}

/**
 * @param {typeof DEFAULT_STUDY_PROGRESS} data
 */
export function buildStudyProgressMarkdown(data) {
  const json = JSON.stringify(data, null, 2);
  return `# 学习进度

本文件由 Study Markdown Reader 维护。下方以 \`${STUDY_PROGRESS_FENCE}\` 标记的 JSON 代码块与顶栏「学习进度」看板一致；进度字段与 \`科目目录/Math.mdc\`、\`科目目录/408.mdc\` 中章节对应（basicThrough / strengthenThrough / through 表示已过章节数）。**《660》**：每科可选 **book660Through**（已做题数）、**book660Total**（本分册总题数，高数默认 360；线代/概率填 0 则看板不显示该科 660 条）、**book660Caption**（看板说明，可选）。可直接改 JSON 后 **Ctrl+S** 保存，再点「刷新 UI」或重新打开看板即可同步。

\`\`\`${STUDY_PROGRESS_FENCE}
${json}
\`\`\`
`;
}
