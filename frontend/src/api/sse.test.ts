import { describe, expect, it } from 'vitest'
import { createSseParser, type SseEvent } from './sse'

function collect(chunks: string[]) {
  const events: SseEvent[] = []
  const parser = createSseParser((e) => events.push(e))
  chunks.forEach((c) => parser.push(c))
  return events
}

describe('createSseParser', () => {
  it('parses complete events', () => {
    expect(collect(['event: token\ndata: {"t":"Hi"}\n\nevent: done\ndata: {}\n\n'])).toEqual([
      { event: 'token', data: '{"t":"Hi"}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('handles events split across arbitrary chunk boundaries', () => {
    const raw = 'event: token\ndata: {"t":"Hello"}\n\nevent: token\ndata: {"t":" world"}\n\n'
    const chunks: string[] = []
    for (let i = 0; i < raw.length; i += 3) chunks.push(raw.slice(i, i + 3))
    expect(collect(chunks).map((e) => e.data)).toEqual(['{"t":"Hello"}', '{"t":" world"}'])
  })

  it('holds an incomplete trailing event until its terminator arrives', () => {
    const events: SseEvent[] = []
    const parser = createSseParser((e) => events.push(e))
    parser.push('event: done\ndata: {}')
    expect(events).toEqual([])
    parser.push('\n\n')
    expect(events).toEqual([{ event: 'done', data: '{}' }])
  })

  it('accepts CRLF line endings, joins multi-line data and ignores comments', () => {
    expect(collect([': keep-alive\r\n\r\ndata: a\r\ndata: b\r\n\r\n'])).toEqual([{ event: 'message', data: 'a\nb' }])
  })
})
