import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_PLAN_PATH_DONE, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** ```smr-plan-path``` JSON 代码块 */
export const PLAN_PATH_FENCE = "smr-plan-path";

export function isPlanPathSourceFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("学习计划路径") || rp.includes("学习计划路径");
}

/** @typedef {{ id: string, label: string, subtitle?: string }} PlanPathNode */

/** @type {PlanPathNode[]} */
export const DEFAULT_PLAN_PATH_NODES = [
  { id: "n1", label: "五月", subtitle: "强化入场 · 660 / 408" },
  { id: "n2", label: "六月", subtitle: "660 主力 · 阅读规律" },
  { id: "n3", label: "七月", subtitle: "错题二刷 · 408 分科真题" },
  { id: "n4", label: "八月", subtitle: "成套模拟 · 真题热身" },
  { id: "n5", label: "九月", subtitle: "23–26 套卷 · 冲刺复盘" },
  { id: "n6", label: "终点", subtitle: "真题闭环 · 上场节奏" },
];

/**
 * 蜿蜒路径（SVG d），供标点坐标采样。
 * viewBox 0 0 820 400
 */
export const PLAN_PATH_D =
  "M 36 372 C 120 96 228 388 316 228 S 476 72 556 196 S 668 52 784 68";

/**
 * @param {string} md
 * @returns {PlanPathNode[]}
 */
export function parsePlanPathFromMarkdown(md) {
  const body = md || "";
  const re = new RegExp(
    "```" + PLAN_PATH_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```",
    "m"
  );
  const m = body.match(re);
  if (!m) return [...DEFAULT_PLAN_PATH_NODES];
  try {
    const parsed = JSON.parse(m[1].trim());
    const nodes = parsed?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) return [...DEFAULT_PLAN_PATH_NODES];
    return nodes
      .filter((x) => x && typeof x.id === "string" && typeof x.label === "string")
      .map((x) => ({
        id: x.id,
        label: x.label,
        subtitle: typeof x.subtitle === "string" ? x.subtitle : "",
      }));
  } catch {
    return [...DEFAULT_PLAN_PATH_NODES];
  }
}

/** @returns {Record<string, boolean>} */
export function readPlanPathDone() {
  try {
    const raw = tryGetLocalStorage(LS_PLAN_PATH_DONE);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, boolean>} map */
export function writePlanPathDone(map) {
  try {
    trySetLocalStorage(LS_PLAN_PATH_DONE, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * 沿路径按节点数取 SVG 坐标（需在浏览器 path 元素已挂载后调用）。
 * @param {SVGPathElement | null} pathEl
 * @param {number} count
 * @returns {{ x: number, y: number }[]}
 */
export function samplePointsOnPath(pathEl, count) {
  if (!pathEl || count <= 0) return [];
  try {
    const len = pathEl.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return [];
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const p = pathEl.getPointAtLength(t * len);
      out.push({ x: p.x, y: p.y });
    }
    return out;
  } catch {
    return [];
  }
}
