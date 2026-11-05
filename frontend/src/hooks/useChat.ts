import { useCallback, useReducer, useRef } from 'react'
import { askStream } from '../api/client'
import { chatReducer } from './chatReducer'

let nextId = 0
const newId = () => String(++nextId)

/** Chat history lives in browser state only; the backend is stateless per question. */
export function useChat() {
  const [messages, dispatch] = useReducer(chatReducer, [])
  const controllerRef = useRef<AbortController | null>(null)

  const isStreaming = messages.some((m) => m.status === 'streaming')

  const send = useCallback(async (raw: string) => {
    const query = raw.trim()
    if (!query || controllerRef.current) return

    const controller = new AbortController()
    controllerRef.current = controller
    const id = newId()
    dispatch({ type: 'start', userId: newId(), assistantId: id, query })

    try {
      await askStream(
        query,
        {
          onSources: (sources) => dispatch({ type: 'sources', id, sources }),
          onToken: (text) => dispatch({ type: 'token', id, text }),
        },
        controller.signal,
      )
      dispatch({ type: 'finish', id, status: 'done' })
    } catch (err) {
      if (controller.signal.aborted) {
        dispatch({ type: 'finish', id, status: 'stopped' })
      } else {
        dispatch({ type: 'fail', id, error: err instanceof Error ? err.message : 'Something went wrong' })
      }
    } finally {
      controllerRef.current = null
    }
  }, [])

  const stop = useCallback(() => controllerRef.current?.abort(), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  return { messages, isStreaming, send, stop, clear }
}
