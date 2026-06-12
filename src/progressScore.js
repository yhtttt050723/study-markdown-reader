import { chapterThroughToPct } from "./studyCatalog.js";
import {
  BOOK660_DEFAULT_TOTAL_CALC,
  CS408_CHAPTER_DEFAULT_MAX,
  DEFAULT_STUDY_PROGRESS,
  ENGLISH_BASIC_UNITS,
  ENGLISH_MUST_UNITS,
  MATH_CHAPTER_DEFAULT_MAX,
} from "./studyProgress.js";

function maxMath(key, chapters) {
  if (chapters?.[key]?.length) return chapters[key].length;
  return MATH_CHAPTER_DEFAULT_MAX[key] ?? 12;
}

function max408(key, chapters) {
  if (chapters?.[key]?.length) return chapters[key].length;
  return CS408_CHAPTER_DEFAULT_MAX[key] ?? 8;
}

function mathSubjectScorePct(row, k, mathCat) {
  const max = maxMath(k, mathCat);
  const a = chapterThroughToPct(row.basicThrough ?? 0, max);
  const b = chapterThroughToPct(row.strengthenThrough ?? 0, max);
  const book660Total =
    typeof row.book660Total === "number" && row.book660Total > 0
      ? row.book660Total
      : k === "高数"
        ? BOOK660_DEFAULT_TOTAL_CALC
        : 0;
  if (book660Total > 0) {
    const c = chapterThroughToPct(row.book660Through ?? 0, book660Total);
    return (a + b + c) / 3;
  }
  return (a + b) / 2;
}

function avgMathBlock(map, keys, mathCat) {
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const row = map[k];
    if (!row) continue;
    sum += mathSubjectScorePct(row, k, mathCat);
    n += 1;
  }
  return n ? sum / n : 0;
}

function avg408Block(cs408, cat408) {
  const keys = Object.keys(DEFAULT_STUDY_PROGRESS.cs408);
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const row = cs408[k];
    if (!row) continue;
    const max = max408(k, cat408);
    sum += chapterThroughToPct(row.through ?? 0, max);
    n += 1;
  }
  return n ? sum / n : 0;
}

function englishScore(eng) {
  if (!eng) return 0;
  const m1 = chapterThroughToPct(eng.mustWords?.round1Unit ?? 0, ENGLISH_MUST_UNITS);
  const m2 = chapterThroughToPct(eng.mustWords?.round2Unit ?? 0, ENGLISH_MUST_UNITS);
  const b1 = chapterThroughToPct(eng.basicWords?.round1Unit ?? 0, ENGLISH_BASIC_UNITS);
  const b2 = chapterThroughToPct(eng.basicWords?.round2Unit ?? 0, ENGLISH_BASIC_UNITS);
  return (m1 + m2 + b1 + b2) / 4;
}

/**
 * 综合进度分 0–100：数一、数二、408、英语 四项简单平均（与看板同一数据源）。
 * @param {typeof DEFAULT_STUDY_PROGRESS} data
 * @param {Record<string, import('./studyCatalog.js').CatalogChapter[]>} [mathCat]
 * @param {Record<string, import('./studyCatalog.js').CatalogChapter[]>} [cat408]
 */
export function computeOverallProgressScore(data, mathCat, cat408) {
  if (!data) return 0;
  const m1 = avgMathBlock(data.math1, ["高数", "线代", "概率论"], mathCat);
  const m2 = avgMathBlock(data.math2, ["高数", "线代"], mathCat);
  const c4 = avg408Block(data.cs408, cat408);
  const en = englishScore(data.english);
  return Math.round(((m1 + m2 + c4 + en) / 4) * 10) / 10;
}
