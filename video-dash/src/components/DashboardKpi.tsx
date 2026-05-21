import { aggregateAll, useSeriesStore } from '../stores/seriesStore'

function fmtMin(sec: number) {
  return Math.round(sec / 60)
}

export function DashboardKpi() {
  const series = useSeriesStore((s) => s.series)
  const { totalSec, watchedSec, seriesCount } = aggregateAll(series)

  const cards = [
    { label: '课程数', value: String(seriesCount), sub: '个 BV 稿件' },
    {
      label: '全稿总时长',
      value: `${fmtMin(totalSec)} 分`,
      sub: `${totalSec}s`,
    },
    {
      label: '已勾选时长',
      value: `${fmtMin(watchedSec)} 分`,
      sub: totalSec ? `${Math.round((watchedSec / totalSec) * 100)}%` : '—',
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {c.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {c.value}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.sub}</p>
        </div>
      ))}
    </section>
  )
}
