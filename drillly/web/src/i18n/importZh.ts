// UI strings for PDF import page
export const importZh = {
  title: 'PDF 导入',
  inboxTitle: '收件箱 · 一键批量转化',
  putPdf: '把 PDF 放到目录：',
  loading: '加载中…',
  inboxHint: '一般为：学习资料\\做题\\PDF待导入',
  refresh: '刷新列表',
  processAll: (n: number) => `一键处理全部 PDF（${n}）`,
  manualTitle: '单文件上传（可选）',
  pagesPerBatch: '每批页数',
  model: '模型',
  noKey: '（未配置 Key）',
  pdfTags: '大标签（可选，逗号分隔；AI 会为每题生成小标签）',
  upload: '上传并拆分',
  selectPdf: '请选择 PDF',
  uploadFail: '上传失败',
  splitBatches: (n: number) => `已拆分 ${n} 个批次`,
  parseFail: '解析失败',
  parsed: (n: number) => `解析 ${n} 题`,
  parsedMeta: (n: number, tag?: string, file?: string) => {
    let s = `解析 ${n} 题`
    if (tag) s += ` · 标签：${tag}`
    if (file) s += ` · 文件：${file}`
    return s
  },
  confirmFail: '入库失败',
  confirmed: (ids: string) => `已入库: ${ids}`,
  inboxEmpty: '收件箱为空，请先把 PDF 放入下方目录',
  confirmBatch: (n: number) => `将处理 ${n} 个 PDF（通义解析并入库），继续？`,
  processing: '批量处理中，请稍候…',
  progressTitle: '导入进度',
  progressFiles: (cur: number, total: number) => `文件 ${cur} / ${total}`,
  progressBatches: (cur: number, total: number, pages: string) =>
    `批次 ${cur} / ${total}（${pages}）`,
  progressWaiting: '准备中…',
  progressDone: '全部完成',
  logPlan: (pending: number, skip: number) =>
    `待处理 ${pending} 个 PDF` + (skip ? `，跳过 ${skip} 个` : ''),
  logSkip: (file: string, reason: string) => `跳过：${file}（${reason}）`,
  logFileStart: (file: string, i: number, n: number) => `[${i}/${n}] 开始：${file}`,
  logSplit: (file: string, batches: number, pages: number) =>
    `${file}：共 ${pages} 页，拆成 ${batches} 批`,
  logBatch: (file: string, i: number, n: number, q: number) =>
    `${file} 第 ${i}/${n} 批 → ${q} 题`,
  logFileDone: (file: string, q: number, tag?: string) =>
    `完成：${file}，入库 ${q} 题` + (tag ? `，大标签 ${tag}` : ''),
  logFileError: (file: string, err: string) => `失败：${file} — ${err}`,
  batchFail: '批量处理失败',
  batchDone: (ok: number, skip: number, err: number) =>
    `完成：新导入 ${ok} 个` +
    (skip ? `，跳过 ${skip} 个（已导入过）` : '') +
    (err ? `，失败 ${err} 个` : '') +
    '。文件可继续留在收件箱，不会重复入库。',
  inboxImported: '已导入',
  batchItem: (file: string, tag?: string, path?: string) => {
    let s = file
    if (tag) s += ` · 标签 ${tag}`
    if (path) s += ` · ${path}`
    return s
  },
  taskHeader: (id: number, name: string, pages: number) =>
    `任务 #${id} · ${name} · 共 ${pages} 页`,
  colBatch: '批次',
  colPages: '页码',
  colStatus: '状态',
  colActions: '操作',
  pageRange: (a: number, b: number) => `第 ${a}–${b} 页`,
  parse: '解析',
  confirm: '入库',
  previewJson: '预览 JSON',
}
