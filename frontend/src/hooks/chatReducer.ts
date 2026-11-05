import type { Source } from '../api/client'

export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  sources?: Source[]
  error?: string
  /** Client-side event times (ms since epoch), used by the live strip */
  marks?: { start: number; sources?: number; firstToken?: number; end?: number }
}

export type ChatAction =
  | { type: 'start'; userId: string; assistantId: string; query: string; at?: number }
  | { type: 'sources'; id: string; sources: Source[]; at?: number }
  | { type: 'token'; id: string; text: string; at?: number }
  | { type: 'finish'; id: string; status: 'done' | 'stopped'; at?: number }
  | { type: 'fail'; id: string; error: string; at?: number }
  | { type: 'clear' }

type Marks = NonNullable<Message['marks']>

/** Record an event time; no-op when the action carries none. */
function mark(m: Message, patch: Partial<Marks>, at?: number): Partial<Message> {
  return at === undefined || !m.marks ? {} : { marks: { ...m.marks, ...patch } }
}

function update(state: Message[], id: string, patch: (m: Message) => Partial<Message>): Message[] {
  return state.map((m) => (m.id === id ? { ...m, ...patch(m) } : m))
}

export function chatReducer(state: Message[], action: ChatAction): Message[] {
  switch (action.type) {
    case 'start':
      return [
        ...state,
        { id: action.userId, role: 'user', content: action.query, status: 'done' },
        {
          id: action.assistantId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          ...(action.at !== undefined && { marks: { start: action.at } }),
        },
      ]
    case 'sources':
      return update(state, action.id, (m) => ({ sources: action.sources, ...mark(m, { sources: action.at }, action.at) }))
    case 'token':
      return update(state, action.id, (m) => ({
        content: m.content + action.text,
        // Only the first token marks the end of the LLM wait
        ...(m.content === '' ? mark(m, { firstToken: action.at }, action.at) : {}),
      }))
    case 'finish':
      return update(state, action.id, (m) => ({ status: action.status, ...mark(m, { end: action.at }, action.at) }))
    case 'fail':
      return update(state, action.id, (m) => ({ status: 'error', error: action.error, ...mark(m, { end: action.at }, action.at) }))
    case 'clear':
      return []
  }
}
