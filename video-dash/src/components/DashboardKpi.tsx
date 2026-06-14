import { useMemo, type ReactNode } from 'react'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  SUBJECTS,
} from '../lib/seriesTaxonomy'
import { formatKpiDuration, formatKpiPercent } from '../lib/durationFormat'
import { aggregateAll, aggregateFiltered, useSeriesStore } from '../stores/seriesStore'

export function DashboardKpi() {
  const series = useSeriesStore((s) => s.series)
  const { totalSec, watchedSec, seriesCount } = aggregateAll(series)
  const { byContentType, bySubject } = useMemo(
    () => aggregateFiltered(series),
    [series],
  )

  const totalFmt = formatKpiDuration(totalSec)
  const watchedFmt = formatKpiDuration(watchedSec)

  const cards = [
    { label: '课程数', value: String(seriesCount), sub: '个 BV 稿件' },
    {
      label: '全稿总时长',
      value: totalFmt.minutesLabel,
      sub: totalFmt.subLabel,
    },
    {
      label: '已勾选时长',
      value: watchedFmt.minutesLabel,
      sub: formatKpiPercent(watchedSec, totalSec),
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      {seriesCount > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <BreakdownPanel title="按内容类型">
            {CONTENT_TYPES.map((t) => {
              const row = byContentType[t]
              if (!row?.count) return null
              return (
                <BreakdownRow
                  key={t}
                  label={CONTENT_TYPE_LABELS[t]}
                  count={row.count}
                  watched={row.watched}
                  total={row.total}
                />
              )
            })}
          </BreakdownPanel>
          <BreakdownPanel title="按科目">
            {SUBJECTS.map((s) => {
              const row = bySubject[s]
              if (!row?.count) return null
              return (
                <BreakdownRow
                  key={s}
                  label={s}
                  count={row.count}
                  watched={row.watched}
                  total={row.total}
                />
              )
            })}
          </BreakdownPanel>
        </div>
      ) : null}
    </section>
  )
}

function BreakdownPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function BreakdownRow({
  label,
  count,
  watched,
  total,
}: {
  label: string
  count: number
  watched: number
  total: number
}) {
  const pct = formatKpiPercent(watched, total)
  const watchedFmt = formatKpiDuration(watched)
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {label}
        <span className="ml-1 text-xs font-normal text-slate-400">({count})</span>
      </span>
      <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
        {watchedFmt.minutesLabel} · {pct}
      </span>
    </div>
  )
}
