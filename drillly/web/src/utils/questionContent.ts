import type { Question } from '../api'

export type QuestionType = 'single_choice' | 'multiple_choice' | 'coding' | 'subjective'

export type QuestionOption = { key: string; content: string }

export function defaultQuestionContent(type: QuestionType = 'subjective'): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type,
    title: '',
    stem: '',
    explanation: '',
    images: [] as string[],
    metadata: {},
  }
  if (type === 'single_choice' || type === 'multiple_choice') {
    return {
      ...base,
      options: [
        { key: 'A', content: '' },
        { key: 'B', content: '' },
        { key: 'C', content: '' },
        { key: 'D', content: '' },
      ],
      answer: type === 'single_choice' ? ['A'] : ['A'],
    }
  }
  if (type === 'coding') {
    return { ...base, language: 'python', starterCode: '', answer: [] }
  }
  return { ...base, answer: [] }
}

export function questionImages(q: Question | Record<string, unknown>): string[] {
  const c = ('content' in q ? q.content : q) as Record<string, unknown>
  const imgs = c?.images
  if (!Array.isArray(imgs)) return []
  return imgs.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
}

export function questionOptions(content: Record<string, unknown>): QuestionOption[] {
  const opts = content.options
  if (!Array.isArray(opts)) return []
  return opts
    .filter((o): o is QuestionOption => typeof o === 'object' && o !== null && 'key' in o)
    .map((o) => ({ key: String(o.key), content: String(o.content ?? '') }))
}

export function answerToText(content: Record<string, unknown>): string {
  const a = content.answer
  if (!Array.isArray(a)) return ''
  return a.map(String).join(', ')
}

export function textToAnswer(text: string, type: QuestionType): string[] {
  const parts = text
    .split(/[,，\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  if (type === 'single_choice') return parts.slice(0, 1)
  return parts
}
