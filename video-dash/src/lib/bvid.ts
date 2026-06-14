const BV_RE = /BV1[a-zA-Z0-9]{9}/i

/**
 * 从任意 B 站链接或文案中提取 BV 号（大写 BV 前缀）。
 */
export function extractBvid(input: string): string | null {
  const m = input.trim().match(BV_RE)
  if (!m) return null
  const raw = m[0]
  return 'BV' + raw.slice(2)
}

/** 合集首页 */
export function bilibiliSeriesUrl(bvid: string) {
  return `https://www.bilibili.com/video/${bvid}`
}

/** 指定分 P */
export function bilibiliPartUrl(bvid: string, page: number) {
  return `${bilibiliSeriesUrl(bvid)}?p=${page}`
}
