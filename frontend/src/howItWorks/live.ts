import type { Message } from '../hooks/chatReducer'

/**
 * Which QUERY_STEPS index the latest question is currently in, derived from the
 * events seen so far. Null when nothing is in flight.
 *
 * The backend only emits sources/token/done, so embed + search share one visible
 * phase (no sources yet), then the LLM runs until the first token arrives.
 */
export function liveStep(messages: Message[]): number | null {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant' || last.status !== 'streaming') return null
  if (!last.sources) return 2
  if (!last.content) return 4
  return 5
}
