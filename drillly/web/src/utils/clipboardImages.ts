const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** 从剪贴板事件提取图片文件（截图 / 复制图片） */
export function imageFilesFromClipboard(e: ClipboardEvent): File[] {
  const dt = e.clipboardData
  if (!dt) return []

  const out: File[] = []
  for (const item of dt.items) {
    if (item.kind !== 'file') continue
    const type = item.type.toLowerCase()
    if (!type.startsWith('image/') || !IMAGE_TYPES.has(type)) continue
    const file = item.getAsFile()
    if (file) out.push(file)
  }
  return out
}

/** 为粘贴的图片生成稳定文件名 */
export function clipboardImageFile(file: File, index: number): File {
  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg'
  const name = file.name && file.name !== 'image.png' ? file.name : `paste-${Date.now()}-${index}.${ext}`
  if (file.name === name) return file
  return new File([file], name, { type: file.type })
}
