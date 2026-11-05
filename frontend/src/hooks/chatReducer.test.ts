import { describe, expect, it } from 'vitest'
import { chatReducer, type Message } from './chatReducer'

const started = chatReducer([], { type: 'start', userId: 'u1', assistantId: 'a1', query: 'Paris?' })

describe('chatReducer', () => {
  it('start adds the user question and a streaming assistant placeholder', () => {
    expect(started).toEqual<Message[]>([
      { id: 'u1', role: 'user', content: 'Paris?', status: 'done' },
      { id: 'a1', role: 'assistant', content: '', status: 'streaming' },
    ])
  })

  it('appends tokens and attaches sources to the assistant message only', () => {
    let state = chatReducer(started, { type: 'sources', id: 'a1', sources: [{ source: 'g.pdf', page: 0, score: 0.9 }] })
    state = chatReducer(state, { type: 'token', id: 'a1', text: 'Visit ' })
    state = chatReducer(state, { type: 'token', id: 'a1', text: 'the Louvre' })
    expect(state[0].content).toBe('Paris?')
    expect(state[1].content).toBe('Visit the Louvre')
    expect(state[1].sources).toHaveLength(1)
  })

  it('finish, fail and clear set terminal states', () => {
    expect(chatReducer(started, { type: 'finish', id: 'a1', status: 'stopped' })[1].status).toBe('stopped')
    const failed = chatReducer(started, { type: 'fail', id: 'a1', error: 'boom' })[1]
    expect(failed).toMatchObject({ status: 'error', error: 'boom' })
    expect(chatReducer(started, { type: 'clear' })).toEqual([])
  })
})
