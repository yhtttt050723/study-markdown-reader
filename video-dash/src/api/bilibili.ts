import type { BiliPagelistResponse, SeriesPart, SeriesRecord } from '../types'

const LIST_PATH = '/bili/x/player/pagelist'

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
  const title =
    parts[0]?.part && !/^课程介绍|^先导|^序/i.test(parts[0].part)
      ? parts[0].part
      : parts[1]?.part || parts[0]?.part || bvid
  return {
    bvid,
    title,
    parts,
    fetchedAt: new Date().toISOString().slice(0, 10),
  }
}
