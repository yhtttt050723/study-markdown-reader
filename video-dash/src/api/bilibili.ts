import { inferSeriesDisplayLabel } from '../lib/seriesLabel'
import {
  inferContentType,
  inferSubject,
} from '../lib/seriesTaxonomy'
import type { BiliPagelistResponse, SeriesPart, SeriesRecord } from '../types'

const LIST_PATH = '/bili/x/player/pagelist'
const VIEW_PATH = '/bili/x/web-interface/view'

type ViewResponse = {
  code: number
  data?: { title?: string }
  message?: string
}

async function fetchViewTitle(bvid: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${VIEW_PATH}?bvid=${encodeURIComponent(bvid)}`,
    )
    if (!res.ok) return undefined
    const json = (await res.json()) as ViewResponse
    if (json.code !== 0) return undefined
    const title = json.data?.title?.trim()
    return title || undefined
  } catch {
    return undefined
  }
}

export async function fetchPagelist(bvid: string): Promise<SeriesRecord> {
  const url = `${LIST_PATH}?bvid=${encodeURIComponent(bvid)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`网络错误 ${res.status}`)
  const json = (await res.json()) as BiliPagelistResponse
  if (json.code !== 0 || !Array.isArray(json.data)) {
    throw new Error(json.message || `接口 code=${json.code}`)
  }
  const parts: SeriesPart[] = json.data.map((row) => ({
    page: row.page,
    part: row.part,
    duration: Math.max(0, Math.floor(row.duration || 0)),
    watched: false,
  }))
  const partNames = parts.map((p) => p.part)
  const fallback =
    parts[0]?.part && !/^课程介绍|^先导|^序/i.test(parts[0].part)
      ? parts[0].part
      : parts[1]?.part || parts[0]?.part || bvid
  const viewTitle = await fetchViewTitle(bvid)
  const title = inferSeriesDisplayLabel(bvid, fallback, partNames, viewTitle)
  const blob = `${title}\n${partNames.slice(0, 20).join('\n')}`
  return {
    bvid,
    title,
    parts,
    fetchedAt: new Date().toISOString().slice(0, 10),
    contentType: inferContentType(blob, fallback, title),
    subject: inferSubject(blob, fallback, bvid),
  }
}
