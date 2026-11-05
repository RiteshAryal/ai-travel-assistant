import type { Message } from '../hooks/chatReducer'
import type { UploadResult } from '../api/client'
import { liveStep } from './live'

export interface ChipState {
  status: 'todo' | 'active' | 'done'
  /** How long the step took; only set once it has finished */
  ms?: number
  /** Extra tooltip text, e.g. when one measurement covers several steps */
  note?: string
}

export interface StripRow {
  chips: ChipState[]
  /** True while something is in flight */
  live: boolean
  totalMs?: number
}

export type UploadRun =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'processing'; uploadMs: number }
  | { phase: 'done'; uploadMs: number; result: UploadResult }
  | { phase: 'error'; uploadMs?: number }

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.max(0, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`
}

const todo = (n: number): ChipState[] => Array.from({ length: n }, () => ({ status: 'todo' }))
const diff = (a?: number, b?: number) => (a !== undefined && b !== undefined ? b - a : undefined)

/**
 * Query row (6 steps). The backend streams only sources/token/done, so durations are
 * measured in the browser between those events: question to sources covers steps 1-4,
 * sources to first token is the LLM wait, first token to done is the stream.
 */
export function queryRow(messages: Message[]): StripRow {
  const last = [...messages].reverse().find((m) => m.role === 'assistant')
  if (!last) return { chips: todo(6), live: false }

  const active = liveStep(messages)
  const m = last.marks
  const finished = last.status !== 'streaming'
  const ok = last.status === 'done'

  const prompt = diff(m?.start, m?.sources)
  const llm = diff(m?.sources, m?.firstToken)
  const stream = diff(m?.firstToken, m?.end)

  const chips = todo(6)
  const at = (i: number, ms?: number, note?: string) => {
    if (ms !== undefined) chips[i] = { status: 'done', ms, note }
  }
  if (ok) for (let i = 0; i < 6; i++) chips[i] = { status: 'done' }
  else if (active !== null) for (let i = 0; i < 6; i++) chips[i] = { status: i < active ? 'done' : i === active ? 'active' : 'todo' }
  else if (finished) for (let i = 0; i < 4; i++) if (m?.sources) chips[i] = { status: 'done' }

  at(3, prompt, 'Measured from sending the question until sources arrive: covers steps 1-4 together.')
  at(4, llm, 'Time from sources arriving until the first token: the LLM wait.')
  at(5, stream, 'Time from the first token until the answer finished.')

  return { chips, live: active !== null, totalMs: finished ? diff(m?.start, m?.end) : undefined }
}

/** Upload row (5 steps). Stage times 2-5 come from the server's `timings`. */
export function uploadRow(run: UploadRun): StripRow {
  const chips = todo(5)
  if (run.phase === 'idle') return { chips, live: false }

  if (run.phase === 'uploading') {
    chips[0] = { status: 'active' }
    return { chips, live: true }
  }

  chips[0] = run.uploadMs !== undefined ? { status: 'done', ms: run.uploadMs } : { status: 'todo' }
  if (run.phase === 'processing') {
    for (let i = 1; i < 5; i++) chips[i] = { status: 'active' }
    return { chips, live: true }
  }
  if (run.phase === 'error') return { chips, live: false }

  const t = run.result.timings
  const ms = t ? [t.extract_ms, t.chunk_ms, t.embed_ms, t.store_ms] : []
  for (let i = 1; i < 5; i++) chips[i] = { status: 'done', ms: ms[i - 1] }
  return { chips, live: false, totalMs: run.uploadMs + ms.reduce((a, b) => a + b, 0) }
}
