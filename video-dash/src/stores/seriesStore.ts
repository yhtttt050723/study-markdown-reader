import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SeriesRecord } from '../types'

type State = {
  series: SeriesRecord[]
  upsertSeries: (record: SeriesRecord) => void
  removeSeries: (bvid: string) => void
  setWatched: (bvid: string, page: number, watched: boolean) => void
}

export const useSeriesStore = create<State>()(
  persist(
    (set) => ({
      series: [],
      upsertSeries: (record) =>
        set((s) => {
          const i = s.series.findIndex((x) => x.bvid === record.bvid)
          if (i < 0) return { series: [...s.series, record] }
          const prev = s.series[i]
          const watchedByPage = new Map(
            prev.parts.map((p) => [p.page, p.watched] as const),
          )
          const mergedParts = record.parts.map((p) => ({
            ...p,
            watched: watchedByPage.get(p.page) ?? false,
          }))
          const next = [...s.series]
          next[i] = { ...record, parts: mergedParts }
          return { series: next }
        }),
      removeSeries: (bvid) =>
        set((s) => ({ series: s.series.filter((x) => x.bvid !== bvid) })),
      setWatched: (bvid, page, watched) =>
        set((s) => ({
          series: s.series.map((ser) => {
            if (ser.bvid !== bvid) return ser
            return {
              ...ser,
              parts: ser.parts.map((p) =>
                p.page === page ? { ...p, watched } : p,
              ),
            }
          }),
        })),
    }),
    { name: 'video-dash-series-v1' },
  ),
)

export function sumSeconds(parts: SeriesRecord['parts']) {
  let total = 0
  let watched = 0
  for (const p of parts) {
    total += p.duration
    if (p.watched) watched += p.duration
  }
  return { total, watched }
}

export function aggregateAll(series: SeriesRecord[]) {
  return series.reduce(
    (acc, s) => {
      const { total, watched } = sumSeconds(s.parts)
      return {
        totalSec: acc.totalSec + total,
        watchedSec: acc.watchedSec + watched,
        seriesCount: acc.seriesCount + 1,
      }
    },
    { totalSec: 0, watchedSec: 0, seriesCount: 0 },
  )
}
