import type { ContentType, Subject } from './lib/seriesTaxonomy'

export type SeriesPart = {
  page: number
  part: string
  duration: number
  watched: boolean
}

export type SeriesRecord = {
  bvid: string
  title: string
  parts: SeriesPart[]
  fetchedAt: string
  contentType: ContentType
  subject: Subject
}

export type BiliPagelistItem = {
  cid: number
  page: number
  part: string
  duration: number
}

export type BiliPagelistResponse = {
  code: number
  message: string
  data?: BiliPagelistItem[]
}
