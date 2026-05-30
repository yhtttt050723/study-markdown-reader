const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || r.statusText)
  }
  if (r.status === 204) return undefined as T
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return r.json()
  return r as unknown as T
}

export type Tag = { id: number; name: string; color: string }
export type TagTreeGroup = {
  name: string
  id?: number
  children: { id: number; name: string; full_name: string; color: string }[]
}
export type Category = { id: number; name: string; color: string; sort_order: number; parent_id: number | null }
export type PracticeState = {
  round1: boolean
  round2: boolean
  source_pdf: string
}

export type Question = {
  id: number
  type: string
  content: Record<string, unknown>
  category_id: number | null
  tags: Tag[]
  category: Category | null
  practice?: PracticeState
}

export type PdfSource = { source_pdf: string; question_count: number }
export type ProgressSummary = { total: number; round1_done: number; round2_done: number }
export type Submission = {
  id: number
  question_id: number
  answer: Record<string, unknown>
  score: number
  is_correct: boolean
  duration_ms: number | null
  created_at: string
}

export const api = {
  health: () => request<{ ok: boolean; question_count?: number }>('/health/'),
  listQuestions: (params: URLSearchParams) =>
    request<Question[]>(`/questions/?${params}`),
  listPracticeQuestions: (params: URLSearchParams) =>
    request<Question[]>(`/practice/questions/?${params}`),
  listPdfSources: () => request<PdfSource[]>('/practice/pdf-sources/'),
  backfillSourceTags: () =>
    request<{ updated: number }>('/practice/backfill-source-tags/', {
      method: 'POST',
      body: '{}',
    }),
  progressSummary: (sourcePdf?: string) => {
    const p = new URLSearchParams()
    if (sourcePdf) p.set('source_pdf', sourcePdf)
    const q = p.toString()
    return request<ProgressSummary>(`/practice/progress/summary/${q ? `?${q}` : ''}`)
  },
  setPracticeProgress: (questionId: number, round: 1 | 2, done: boolean) =>
    request<{ ok: boolean }>(`/practice/progress/${questionId}/`, {
      method: 'POST',
      body: JSON.stringify({ round, done }),
    }),
  listCategories: () => request<Category[]>('/questions/categories/'),
  listTags: () => request<Tag[]>('/questions/tags/'),
  listTagTree: () => request<TagTreeGroup[]>('/questions/tags/tree/'),
  createTag: (body: { name: string; color?: string }) =>
    request<Tag>('/questions/tags/', { method: 'POST', body: JSON.stringify(body) }),
  getQuestion: (id: number) => request<Question>(`/questions/${id}/`),
  createQuestion: (body: {
    type: string
    content: Record<string, unknown>
    category_id?: number | null
    tag_ids?: number[]
  }) =>
    request<Question>('/questions/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchQuestion: (
    id: number,
    body: {
      type?: string
      category_id?: number | null
      tag_ids?: number[]
      content?: Record<string, unknown>
    },
  ) =>
    request<Question>(`/questions/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteQuestion: (id: number) =>
    request<{ ok: boolean }>(`/questions/${id}/`, { method: 'DELETE' }),
  uploadQuestionImage: async (questionId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`${BASE}/questions/${questionId}/images/`, {
      method: 'POST',
      body: fd,
    })
    if (!r.ok) throw new Error(await r.text() || r.statusText)
    return r.json() as Promise<{ url: string; images: string[] }>
  },
  deleteQuestionImage: (questionId: number, url: string) => {
    const p = new URLSearchParams({ url })
    return request<{ ok: boolean; images: string[] }>(
      `/questions/${questionId}/images/?${p}`,
      { method: 'DELETE' },
    )
  },
  submit: (body: {
    question_id: number
    answer: Record<string, unknown>
    language?: string
    duration_ms?: number
    practice_round?: 1 | 2
  }) =>
    request<Submission>('/practice/submit/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submissions: (questionId: number) =>
    request<Submission[]>(`/practice/submissions/?question_id=${questionId}`),
  runCode: (body: { language: string; code: string; stdin?: string }) =>
    request<{ stdout: string; stderr: string; exit_code: number; timed_out: boolean }>(
      '/runner/execute/',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  providers: () =>
    request<{ id: string; label: string; model: string; available: boolean }[]>(
      '/import/providers/',
    ),
  uploadPdf: (form: FormData) =>
    request<{ task_id: number; batches: number }>('/import/pdf/', {
      method: 'POST',
      body: form,
    }),
  getTask: (id: number) => request<ImportTask>(`/import/tasks/${id}/`),
  parseBatch: (taskId: number, batchId: number, provider: string, model?: string) =>
    request<{
      questions: unknown[]
      count: number
      pdf_tag?: string
      source_pdf?: string
      source_path?: string
    }>(
      `/import/tasks/${taskId}/batches/${batchId}/parse/`,
      {
        method: 'POST',
        body: JSON.stringify({ provider, model }),
      },
    ),
  confirmBatch: (taskId: number, batchId: number) =>
    request<{ created_question_ids: number[] }>(
      `/import/tasks/${taskId}/batches/${batchId}/confirm/`,
      { method: 'POST', body: '{}' },
    ),
  exportUrl: (params: URLSearchParams) => `${BASE}/practice/export/markdown/?${params}`,
  getSettings: () => request<PublicSettings>('/settings/'),
  patchSettings: (body: Record<string, string | number>) =>
    request<PublicSettings>('/settings/', { method: 'PATCH', body: JSON.stringify(body) }),
  getInbox: () =>
    request<{ inbox_dir: string; files: InboxFile[] }>('/import/inbox/'),
  getImportJobState: () => request<ImportJobState>('/import/inbox/job-state/'),
  cancelInboxImport: () =>
    request<{ ok: boolean; message: string }>('/import/inbox/cancel/', {
      method: 'POST',
      body: '{}',
    }),
  clearImportJob: () =>
    request<{ ok: boolean }>('/import/inbox/clear-job/', { method: 'POST', body: '{}' }),
  resetInboxFile: (filename: string) =>
    request<{ file: string; questions_deleted: number; ledger_cleared: boolean }>(
      '/import/inbox/reset/',
      { method: 'POST', body: JSON.stringify({ filename }) },
    ),
  getFailedBatches: () =>
    request<{
      pending: { file: string; batch_index: number; page_start: number; page_end: number; error: string; chunk_path?: string }[]
      count_by_file: Record<string, number>
      total: number
    }>('/import/inbox/failed-batches/'),
  processInboxAll: (body: InboxProcessBody) =>
    request<InboxProcessResult>('/import/inbox/process-all/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  syncWrongbook: () =>
    request<{ ok: boolean; path: string; message: string }>('/sync/study/wrongbook/', {
      method: 'POST',
      body: '{}',
    }),
  syncPaths: () => request<SyncPaths>('/sync/paths/'),
}

export type PublicSettings = {
  tongyi_api_key_masked: string
  deepseek_api_key_masked: string
  tongyi_configured: boolean
  deepseek_configured: boolean
  llm_default_provider: string
  pdf_inbox_dir: string
  pdf_pages_per_batch: number
  study_export_wrongbook: string
  study_video_progress_file: string
}

export type InboxFile = {
  name: string
  path: string
  size_mb: number
  imported?: boolean
  imported_at?: string
  task_id?: number
  question_count?: number
  questions_in_db?: number
}

export type ImportJobState = {
  active: boolean
  logs: string[]
  progress?: {
    percent?: number
    file_index?: number
    file_name?: string
    batch_index?: number
    batch_total?: number
  }
  summary?: InboxProcessResult
}
export type InboxProcessBody = {
  provider: string
  model?: string
  tags: string
  pages_per_batch: number
  auto_confirm: boolean
  /** 单文件导入 / 重试失败批次时必填 */
  filename?: string
}
export type InboxProcessItem = {
  file: string
  source_path?: string
  pdf_tag?: string
  task_id: number
  batches: number
  batch_errors?: number
  partial?: boolean
  parsed_questions: number
  created_question_ids: number[]
  questions_in_db?: number
  moved_to?: string
  kept_in_inbox?: boolean
}
export type InboxSkippedItem = {
  file: string
  reason: string
  task_id?: number
  imported_at?: string
}
export type InboxProcessResult = {
  processed: number
  skipped: number
  results: InboxProcessItem[]
  skipped_files: InboxSkippedItem[]
  errors: { file: string; error: string }[]
}
export type SyncPaths = {
  wrongbook_export_dir: string
  video_progress_file: string
  video_progress_hint: string
}

export type ImportTask = {
  id: number
  original_name: string
  total_pages: number
  pages_per_batch: number
  status: string
  tags: { id: number; name: string }[]
  batches: { id: number; page_start: number; page_end: number; status: string }[]
}
