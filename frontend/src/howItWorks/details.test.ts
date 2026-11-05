import { describe, expect, it } from 'vitest'
import type { AskTrace, UploadResult } from '../api/client'
import type { Message } from '../hooks/chatReducer'
import { askDetails, uploadDetails } from './details'

const trace: AskTrace = {
  embed: { model: 'mini', dim: 384, query: 'Paris?', ms: 12 },
  search: { collection: 'c', top_k: 5, hits: [{ source: 'g.pdf', page: 2, score: 0.81234, text: 'Louvre' }], ms: 3 },
  prompt: { chunks: 1, chars: 99, text: 'PROMPT' },
  llm: { provider: 'openai', model: 'gpt-x' },
}

const messages = (extra: Partial<Message> = {}): Message[] => [
  { id: 'u', role: 'user', content: 'Paris?', status: 'done' },
  { id: 'a', role: 'assistant', content: 'Visit', status: 'streaming', ...extra },
]

describe('askDetails', () => {
  it('is empty without an assistant message', () => {
    expect(askDetails([])).toEqual({})
  })

  it('only has the question step before the trace arrives', () => {
    const d = askDetails(messages())
    expect(Object.keys(d)).toEqual(['question'])
    expect(d.question.in).toContain('"Paris?"')
  })

  it('describes every step once trace and sources arrived', () => {
    const d = askDetails(messages({ trace, sources: [{ source: 'g.pdf', page: 2, score: 0.8 }] }))
    expect(Object.keys(d)).toEqual(['question', 'embed', 'search', 'prompt', 'llm', 'stream'])
    expect(d.embed.out).toBe('384-dim vector in 12 ms')
    expect(d.search.out).toContain('p.3 g.pdf 0.812')
    expect(d.prompt.body).toBe('PROMPT')
    expect(d.llm.in).toBe('openai / gpt-x')
  })
})

describe('uploadDetails', () => {
  const result: UploadResult = {
    message: 'ok',
    filename: 'g.pdf',
    pages: 2,
    chunks: 4,
    trace: {
      extract: { bytes: 2048, pages: 2, chars: 900 },
      chunk: { size: 500, overlap: 100, count: 4, first: 'hello' },
      embed: { model: 'mini', dim: 384, count: 4 },
      store: { collection: 'c', points: 4, first_id: 'id1' },
    },
  }

  it('is empty until the upload finished', () => {
    expect(uploadDetails({ phase: 'processing', uploadMs: 5 })).toEqual({})
  })

  it('maps the server trace onto upload steps', () => {
    const d = uploadDetails({ phase: 'done', uploadMs: 5, result })
    expect(Object.keys(d)).toEqual(['upload', 'extract', 'chunk', 'embed-chunks', 'store'])
    expect(d.upload.in).toContain('g.pdf (2.0 KB)')
    expect(d.store.out).toContain('first id id1')
  })

  it('is empty when the server sent no trace (older backend)', () => {
    expect(uploadDetails({ phase: 'done', uploadMs: 5, result: { ...result, trace: undefined } })).toEqual({})
  })
})
