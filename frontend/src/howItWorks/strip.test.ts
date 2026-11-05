import { describe, expect, it } from 'vitest'
import type { Message } from '../hooks/chatReducer'
import { formatMs, queryRow, uploadRow } from './strip'

const assistant = (patch: Partial<Message>): Message => ({
  id: 'a',
  role: 'assistant',
  content: '',
  status: 'streaming',
  marks: { start: 1000 },
  ...patch,
})

describe('formatMs', () => {
  it('uses ms below a second and seconds above', () => {
    expect(formatMs(420)).toBe('420 ms')
    expect(formatMs(1250)).toBe('1.3 s')
  })
})

describe('failures', () => {
  it('flags vector search when the question fails before any sources', () => {
    const row = queryRow([assistant({ status: 'error', error: 'boom', marks: { start: 1000, end: 1500 } })])
    expect(row.failed).toBe(true)
    expect(row.chips.map((c) => c.status)).toEqual(['done', 'done', 'error', 'todo', 'todo', 'todo'])
  })

  it('flags the LLM when sources arrived but no tokens', () => {
    const row = queryRow([assistant({ status: 'error', sources: [], marks: { start: 1000, sources: 1800, end: 2000 } })])
    expect(row.chips[3]).toMatchObject({ status: 'done', ms: 800 })
    expect(row.chips[4].status).toBe('error')
    expect(row.chips[5].status).toBe('todo')
  })

  it('keeps the stream step red even though it has a duration', () => {
    const row = queryRow([
      assistant({ status: 'error', content: 'Par', sources: [], marks: { start: 1000, sources: 1800, firstToken: 2500, end: 3000 } }),
    ])
    expect(row.chips[5].status).toBe('error')
  })

  it('flags upload when the file never reached the server', () => {
    const row = uploadRow({ phase: 'error' })
    expect(row.failed).toBe(true)
    expect(row.chips[0].status).toBe('error')
  })

  it('flags all server-side steps when processing failed', () => {
    const row = uploadRow({ phase: 'error', uploadMs: 120 })
    expect(row.chips.map((c) => c.status)).toEqual(['done', 'error', 'error', 'error', 'error'])
  })
})

describe('queryRow', () => {
  it('is idle with no assistant message', () => {
    const row = queryRow([])
    expect(row.live).toBe(false)
    expect(row.chips.every((c) => c.status === 'todo')).toBe(true)
  })

  it('shows durations as soon as each phase ends', () => {
    const row = queryRow([assistant({ sources: [], marks: { start: 1000, sources: 1800 } })])
    expect(row.live).toBe(true)
    expect(row.chips[3]).toMatchObject({ status: 'done', ms: 800 })
    expect(row.chips[4]).toMatchObject({ status: 'active' })
    expect(row.chips[4].ms).toBeUndefined()
  })

  it('keeps everything done with durations and a total after finishing', () => {
    const row = queryRow([
      assistant({
        status: 'done',
        content: 'hi',
        sources: [],
        marks: { start: 1000, sources: 1800, firstToken: 3000, end: 4000 },
      }),
    ])
    expect(row.live).toBe(false)
    expect(row.chips.every((c) => c.status === 'done')).toBe(true)
    expect([row.chips[3].ms, row.chips[4].ms, row.chips[5].ms]).toEqual([800, 1200, 1000])
    expect(row.totalMs).toBe(3000)
  })
})

describe('uploadRow', () => {
  const result = {
    message: '',
    filename: 'a.pdf',
    pages: 1,
    chunks: 2,
    timings: { extract_ms: 10, chunk_ms: 5, embed_ms: 900, store_ms: 85 },
  }

  it('walks through the phases', () => {
    expect(uploadRow({ phase: 'uploading' }).chips[0].status).toBe('active')
    const processing = uploadRow({ phase: 'processing', uploadMs: 120 })
    expect(processing.chips[0]).toMatchObject({ status: 'done', ms: 120 })
    expect(processing.chips.slice(1).every((c) => c.status === 'active')).toBe(true)
  })

  it('reports server stage timings when done', () => {
    const row = uploadRow({ phase: 'done', uploadMs: 100, result })
    expect(row.chips.map((c) => c.ms)).toEqual([100, 10, 5, 900, 85])
    expect(row.totalMs).toBe(1100)
  })
})
