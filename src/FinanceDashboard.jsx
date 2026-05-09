import { useEffect, useMemo, useState } from "react";
import {
  computeFinanceStats,
  newFinanceEntryId,
  parseAmountInput,
  todayStr,
} from "./finance.js";

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `¥${v.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function FinanceDashboard({ state, onChange, onClose }) {
  const stats = useMemo(() => computeFinanceStats(state.entries), [state.entries]);

  const [date, setDate] = useState(() => todayStr());
  const [amountRaw, setAmountRaw] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [subtractFromBalance, setSubtractFromBalance] = useState(true);

  const [balanceInput, setBalanceInput] = useState(() =>
    state.balance != null ? String(state.balance) : ""
  );
  const [budgetInput, setBudgetInput] = useState(() =>
    state.monthlyBudget != null ? String(state.monthlyBudget) : ""
  );

  useEffect(() => {
    setBalanceInput(state.balance != null ? String(state.balance) : "");
  }, [state.balance]);

  useEffect(() => {
    setBudgetInput(state.monthlyBudget != null ? String(state.monthlyBudget) : "");
  }, [state.monthlyBudget]);

  const budgetRemaining =
    state.monthlyBudget != null && Number.isFinite(state.monthlyBudget)
      ? Math.round((state.monthlyBudget - stats.month) * 100) / 100
      : null;

  const sortedEntries = useMemo(() => {
    return [...state.entries].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.id.localeCompare(a.id);
    });
  }, [state.entries]);

  function applyBalanceDelta(delta, allow) {
    if (!allow || state.balance == null || !Number.isFinite(state.balance)) return state.balance;
    return Math.round((state.balance - delta) * 100) / 100;
  }

  function handleAddExpense(e) {
    e.preventDefault();
    const amount = parseAmountInput(amountRaw);
    if (amount == null || amount === 0) return;

    const entry = {
      id: newFinanceEntryId(),
      date: date.slice(0, 10),
      amount,
      note: note.trim(),
      category: category.trim(),
    };

    const nextBalance = applyBalanceDelta(amount, subtractFromBalance);

    onChange({
      ...state,
      balance: nextBalance != null ? nextBalance : state.balance,
      entries: [...state.entries, entry],
    });

    setAmountRaw("");
    setNote("");
    setCategory("");
    setDate(todayStr());
  }

  function commitBalance() {
    const s = balanceInput.trim();
    if (!s) {
      onChange({ ...state, balance: null });
      return;
    }
    const n = parseAmountInput(s);
    if (n == null) {
      setBalanceInput(state.balance != null ? String(state.balance) : "");
      return;
    }
    onChange({ ...state, balance: n });
  }

  function commitBudget() {
    const s = budgetInput.trim();
    if (!s) {
      onChange({ ...state, monthlyBudget: null });
      return;
    }
    const n = parseAmountInput(s);
    if (n == null) {
      setBudgetInput(state.monthlyBudget != null ? String(state.monthlyBudget) : "");
      return;
    }
    onChange({ ...state, monthlyBudget: n });
  }

  function removeEntry(id) {
    onChange({
      ...state,
      entries: state.entries.filter((x) => x.id !== id),
    });
  }

  return (
    <div className="finance-overlay" role="dialog" aria-modal="true" aria-labelledby="finance-title">
      <div className="finance-panel">
        <div className="finance-toolbar">
          <h2 id="finance-title" className="finance-title">
            记账与经济状况
          </h2>
          <div className="finance-toolbar-btns">
            <button type="button" className="ghost-btn" onClick={onClose}>
              关闭（Esc）
            </button>
          </div>
        </div>

        <p className="finance-hint">
          数据保存在本机 <code>smr-finance-state</code>，可与学习笔记同一浏览器配置长期使用。
        </p>

        <div className="finance-summary">
          <div className="finance-card finance-card--accent">
            <span className="finance-card-label">当前余额（可支配）</span>
            <div className="finance-card-row">
              <input
                className="finance-inline-input"
                type="text"
                inputMode="decimal"
                placeholder="未设置"
                value={balanceInput}
                onChange={(ev) => setBalanceInput(ev.target.value)}
                onBlur={commitBalance}
              />
            </div>
          </div>
          <div className="finance-card">
            <span className="finance-card-label">今日支出</span>
            <strong className="finance-card-value">{fmtMoney(stats.today)}</strong>
          </div>
          <div className="finance-card">
            <span className="finance-card-label">近 7 日支出</span>
            <strong className="finance-card-value">{fmtMoney(stats.week7)}</strong>
          </div>
          <div className="finance-card">
            <span className="finance-card-label">本月支出</span>
            <strong className="finance-card-value">{fmtMoney(stats.month)}</strong>
          </div>
          <div className="finance-card">
            <span className="finance-card-label">月预算</span>
            <div className="finance-card-row">
              <input
                className="finance-inline-input"
                type="text"
                inputMode="decimal"
                placeholder="可选"
                value={budgetInput}
                onChange={(ev) => setBudgetInput(ev.target.value)}
                onBlur={commitBudget}
              />
            </div>
            {budgetRemaining != null && (
              <span className="finance-card-sub">
                剩余预算 {fmtMoney(budgetRemaining)}
                {budgetRemaining < 0 && <span className="finance-warn">（已超支）</span>}
              </span>
            )}
          </div>
        </div>

        <form className="finance-form" onSubmit={handleAddExpense}>
          <h3 className="finance-h3">记一笔支出</h3>
          <div className="finance-form-grid">
            <label className="finance-field">
              <span>日期</span>
              <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
            </label>
            <label className="finance-field">
              <span>金额（元）</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amountRaw}
                onChange={(ev) => setAmountRaw(ev.target.value)}
              />
            </label>
            <label className="finance-field finance-field--wide">
              <span>备注</span>
              <input
                type="text"
                placeholder="可选"
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
              />
            </label>
            <label className="finance-field">
              <span>分类</span>
              <input
                type="text"
                placeholder="餐饮、交通…"
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
              />
            </label>
          </div>
          <label className="finance-check">
            <input
              type="checkbox"
              checked={subtractFromBalance}
              disabled={state.balance == null || !Number.isFinite(state.balance)}
              onChange={(ev) => setSubtractFromBalance(ev.target.checked)}
            />
            <span>从当前余额中扣减（需已填写余额）</span>
          </label>
          <button type="submit" className="finance-submit">
            添加支出
          </button>
        </form>

        <section className="finance-section">
          <h3 className="finance-h3">流水（新在上）</h3>
          {sortedEntries.length === 0 ? (
            <p className="finance-empty">暂无记录。在上方的表单中添加支出即可。</p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>金额</th>
                    <th>分类</th>
                    <th>备注</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td className="finance-num">{fmtMoney(row.amount)}</td>
                      <td>{row.category || "—"}</td>
                      <td className="finance-note">{row.note || "—"}</td>
                      <td>
                        <button type="button" className="finance-row-del" onClick={() => removeEntry(row.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
