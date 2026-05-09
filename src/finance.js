import { LS_FINANCE_STATE, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

const VERSION = 1;

export function defaultFinanceState() {
  return {
    version: VERSION,
    balance: null,
    monthlyBudget: null,
    entries: [],
  };
}

function isFiniteNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function normalizeEntry(e) {
  if (!e || typeof e.id !== "string") return null;
  const date = typeof e.date === "string" ? e.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const amount = Number(e.amount);
  if (!isFiniteNum(amount) || amount < 0) return null;
  const note = typeof e.note === "string" ? e.note : "";
  const category =
    typeof e.category === "string" && e.category.trim() ? e.category.trim() : "";
  return { id: e.id, date, amount, note, category };
}

export function readFinanceState() {
  const raw = tryGetLocalStorage(LS_FINANCE_STATE);
  if (!raw) return defaultFinanceState();
  try {
    const o = JSON.parse(raw);
    if (!o || o.version !== VERSION) return defaultFinanceState();
    const entries = Array.isArray(o.entries)
      ? o.entries.map(normalizeEntry).filter(Boolean)
      : [];
    return {
      version: VERSION,
      balance: isFiniteNum(o.balance) ? o.balance : null,
      monthlyBudget: isFiniteNum(o.monthlyBudget) ? o.monthlyBudget : null,
      entries,
    };
  } catch {
    return defaultFinanceState();
  }
}

export function writeFinanceState(state) {
  trySetLocalStorage(LS_FINANCE_STATE, JSON.stringify(state));
}

export function newFinanceEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sumEntriesInRange(entries, startStr, endStr) {
  let sum = 0;
  for (const e of entries) {
    if (e.date >= startStr && e.date <= endStr) sum += e.amount;
  }
  return Math.round(sum * 100) / 100;
}

/** 今日、滚动近 7 日、本月（月初至今日）支出合计 */
export function computeFinanceStats(entries) {
  const today = todayStr();
  const end = new Date();
  const start7 = new Date(end);
  start7.setDate(end.getDate() - 6);
  const startStr = formatDateStr(start7);
  const endStr = formatDateStr(end);
  const monthStart = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`;

  return {
    today: sumEntriesInRange(entries, today, today),
    week7: sumEntriesInRange(entries, startStr, endStr),
    month: sumEntriesInRange(entries, monthStart, today),
  };
}

export function parseAmountInput(raw) {
  const s = String(raw ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
