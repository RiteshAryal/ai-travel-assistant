import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'

export type HealthState = 'checking' | 'ok' | 'degraded' | 'down'

const POLL_MS = 15_000

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    const check = async () => {
      try {
        const health = await getHealth(controller.signal)
        setState(health.status === 'ok' ? 'ok' : 'degraded')
      } catch {
        if (!controller.signal.aborted) setState('down')
      }
    }

    check()
    const timer = setInterval(check, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return state
}
