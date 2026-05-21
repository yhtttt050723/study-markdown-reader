import type { SeriesRecord } from '../types'

const LINE_RE =
  /^(-\s*)\[([^\]]*)\](\s+\*\*P(\d+)\*\*\s*[（(]\d+s[）)].*)$/

/**
 * 按当前勾选状态更新「分 P 清单」里每一行 `- [ ] **Pk**（…）` 的方括号。
 * 保留行其余部分（标题、链接）不变。
 */
export function applyWatchedToMarkdown(
  content: string,
  series: SeriesRecord,
): string {
  const watchedByPage = new Map(
    series.parts.map((p) => [p.page, p.watched] as const),
  )
  const lines = content.split(/\r?\n/)
  const out = lines.map((line) => {
    const m = line.match(LINE_RE)
    if (!m) return line
    const page = Number(m[4])
    if (!Number.isFinite(page)) return line
    const watched = watchedByPage.get(page)
    if (watched === undefined) return line
    const mark = watched ? 'x' : ' '
    return `${m[1]}[${mark}]${m[3]}`
  })
  let joined = out.join('\n')

  const done = series.parts.filter((p) => p.watched).length
  const total = series.parts.length
  joined = joined.replace(
    /^(- \*\*已勾选完成\*\*[：:]\s*)([^\n]*)$/m,
    `$1${done} / ${total}`,
  )

  return joined
}

/** 在目录中查找 `BVxxx-*.md` 或 `BVxxx.md` */
export async function findBvMarkdownHandle(
  dir: FileSystemDirectoryHandle,
  bvid: string,
): Promise<{ name: string; handle: FileSystemFileHandle } | null> {
  const esc = bvid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reDash = new RegExp(`^${esc}-.+\\.md$`, 'i')
  const rePlain = new RegExp(`^${esc}\\.md$`, 'i')
  const candidates: { name: string; handle: FileSystemFileHandle }[] = []
  for await (const ent of dir.values()) {
    if (ent.kind !== 'file') continue
    const name = ent.name
    if (!name.toLowerCase().endsWith('.md')) continue
    if (rePlain.test(name) || reDash.test(name)) {
      candidates.push({ name, handle: ent as FileSystemFileHandle })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.name.localeCompare(b.name))
  return candidates[0]
}

export async function readFileText(fh: FileSystemFileHandle): Promise<string> {
  const file = await fh.getFile()
  return file.text()
}

export async function writeFileText(
  fh: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const w = await fh.createWritable()
  await w.write(text)
  await w.close()
}

export function buildMarkdownFromSeries(series: SeriesRecord): string {
  const lines = series.parts.map((p) => {
    const mark = p.watched ? 'x' : ' '
    const title = p.part.replace(/\]/g, '\\]')
    const url = `https://www.bilibili.com/video/${series.bvid}?p=${p.page}`
    return `- [${mark}] **P${p.page}**（${p.duration}s）— [${title}](${url})`
  })
  const watchedCount = series.parts.filter((p) => p.watched).length
  const yaml = `---
bvid: ${series.bvid}
series_title: "${series.title.replace(/"/g, '\\"')}"
episode_count: ${series.parts.length}
watched_count: ${watchedCount}
last_sync_api: "${series.fetchedAt}"
watch_hint: "由 video-dash 生成"
---

# ${series.title}

- **合集**：https://www.bilibili.com/video/${series.bvid}

## 分 P 清单（勾选 = 已看完本集）

${lines.join('\n')}
`
  return yaml
}
