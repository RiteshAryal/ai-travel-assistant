import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth } from '../api/client'

export type HealthState = 'checking' | 'ok' | 'degraded' | 'down'

const POLL_MS = 15_000

export interface HealthInfo {
  state: HealthState
  /** Indexed chunks; undefined while unknown (still checking or backend unreachable) */
  chunks?: number
  /** Check again now, e.g. right after an upload */
  refresh: () => void
}

export function useHealth(): HealthInfo {
  const [state, setState] = useState<HealthState>('checking')
  const [chunks, setChunks] = useState<number>()
  const checkRef = useRef<() => void>(() => {})

  useEffect(() => {
    const controller = new AbortController()

    const check = async () => {
      try {
        const health = await getHealth(controller.signal)
        setState(health.status === 'ok' ? 'ok' : 'degraded')
        setChunks(health.chunks)
      } catch {
        if (controller.signal.aborted) return
        setState('down')
        setChunks(undefined)
      }
    }

    checkRef.current = check
    check()
    const timer = setInterval(check, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  const refresh = useCallback(() => checkRef.current(), [])
  return { state, chunks, refresh }
}
