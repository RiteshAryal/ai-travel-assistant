import type { Source } from '../api/client'

export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  sources?: Source[]
  error?: string
}

export type ChatAction =
  | { type: 'start'; userId: string; assistantId: string; query: string }
  | { type: 'sources'; id: string; sources: Source[] }
  | { type: 'token'; id: string; text: string }
  | { type: 'finish'; id: string; status: 'done' | 'stopped' }
  | { type: 'fail'; id: string; error: string }
  | { type: 'clear' }

function update(state: Message[], id: string, patch: (m: Message) => Partial<Message>): Message[] {
  return state.map((m) => (m.id === id ? { ...m, ...patch(m) } : m))
}

export function chatReducer(state: Message[], action: ChatAction): Message[] {
  switch (action.type) {
    case 'start':
      return [
        ...state,
        { id: action.userId, role: 'user', content: action.query, status: 'done' },
        { id: action.assistantId, role: 'assistant', content: '', status: 'streaming' },
      ]
    case 'sources':
      return update(state, action.id, () => ({ sources: action.sources }))
    case 'token':
      return update(state, action.id, (m) => ({ content: m.content + action.text }))
    case 'finish':
      return update(state, action.id, () => ({ status: action.status }))
    case 'fail':
      return update(state, action.id, () => ({ status: 'error', error: action.error }))
    case 'clear':
      return []
  }
}
