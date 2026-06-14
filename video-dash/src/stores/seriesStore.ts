import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  inferContentType,
  inferSubject,
  type ContentType,
  type Subject,
} from '../lib/seriesTaxonomy'
import type { SeriesRecord } from '../types'

type State = {
  series: SeriesRecord[]
  upsertSeries: (record: SeriesRecord) => void
  removeSeries: (bvid: string) => void
  setWatched: (bvid: string, page: number, watched: boolean) => void
  setSeriesMeta: (
    bvid: string,
    meta: { contentType?: ContentType; subject?: Subject },
  ) => void
}

function ensureTaxonomy(record: SeriesRecord, prev?: SeriesRecord): SeriesRecord {
  const partNames = record.parts.map((p) => p.part)
  const blob = `${record.title}\n${partNames.slice(0, 20).join('\n')}`
  return {
    ...record,
    contentType:
      prev?.contentType ||
      record.contentType ||
      inferContentType(blob, record.title, record.title),
    subject:
      prev?.subject ||
      record.subject ||
      inferSubject(blob, record.title, record.bvid),
  }
}

export const useSeriesStore = create<State>()(
  persist(
    (set) => ({
      series: [],
      upsertSeries: (record) =>
        set((s) => {
          const i = s.series.findIndex((x) => x.bvid === record.bvid)
          if (i < 0) {
            return { series: [...s.series, ensureTaxonomy(record)] }
          }
          const prev = s.series[i]
          const watchedByPage = new Map(
            prev.parts.map((p) => [p.page, p.watched] as const),
          )
          const mergedParts = record.parts.map((p) => ({
            ...p,
            watched: watchedByPage.get(p.page) ?? false,
          }))
          const next = [...s.series]
          next[i] = ensureTaxonomy(
            { ...record, parts: mergedParts },
            prev,
          )
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
      setSeriesMeta: (bvid, meta) =>
        set((s) => ({
          series: s.series.map((ser) => {
            if (ser.bvid !== bvid) return ser
            return {
              ...ser,
              contentType: meta.contentType ?? ser.contentType,
              subject: meta.subject ?? ser.subject,
            }
          }),
        })),
    }),
    {
      name: 'video-dash-series-v1',
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as { series?: SeriesRecord[] }
        if (!state?.series) return { series: [] }
        return {
          series: state.series.map((ser) => ensureTaxonomy(ser)),
        }
      },
    },
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

export function aggregateFiltered(series: SeriesRecord[]) {
  const byContentType: Partial<Record<ContentType, { watched: number; total: number; count: number }>> =
    {}
  const bySubject: Partial<Record<Subject, { watched: number; total: number; count: number }>> =
    {}

  for (const s of series) {
    const { total, watched } = sumSeconds(s.parts)
    const ct = byContentType[s.contentType] ?? { watched: 0, total: 0, count: 0 }
    ct.watched += watched
    ct.total += total
    ct.count += 1
    byContentType[s.contentType] = ct

    const sb = bySubject[s.subject] ?? { watched: 0, total: 0, count: 0 }
    sb.watched += watched
    sb.total += total
    sb.count += 1
    bySubject[s.subject] = sb
  }

  return { byContentType, bySubject }
}
