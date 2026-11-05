import { describe, expect, it } from 'vitest'
import type { Message } from '../hooks/chatReducer'
import { liveStep } from './live'

const assistant = (patch: Partial<Message>): Message => ({
  id: '1',
  role: 'assistant',
  content: '',
  status: 'streaming',
  ...patch,
})

describe('liveStep', () => {
  it('is null with no messages or when not streaming', () => {
    expect(liveStep([])).toBeNull()
    expect(liveStep([assistant({ status: 'done' })])).toBeNull()
  })

  it('follows the stream events', () => {
    expect(liveStep([assistant({})])).toBe(2)
    expect(liveStep([assistant({ sources: [] })])).toBe(4)
    expect(liveStep([assistant({ sources: [], content: 'Hi' })])).toBe(5)
  })
})
