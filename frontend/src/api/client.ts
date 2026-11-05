import { createSseParser } from './sse'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Optional client-side upload limit (MB); keep in sync with backend MAX_UPLOAD_MB. Unset = no check. */
const maxUploadMb = Number(import.meta.env.VITE_MAX_UPLOAD_MB)
export const MAX_UPLOAD_MB = maxUploadMb > 0 ? maxUploadMb : null

export interface Source {
  source: string
  page: number
  score: number
  text?: string
}

export interface UploadResult {
  message: string
  filename: string
  pages: number
  chunks: number
  /** Server-side time per ingestion stage, in milliseconds */
  timings?: { extract_ms: number; chunk_ms: number; embed_ms: number; store_ms: number }
}

export interface Health {
  status: 'ok' | 'degraded'
  qdrant: boolean
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const UNREACHABLE = 'Could not reach the server'

function url(path: string) {
  return `${API_BASE}/api${path}`
}

/** Turn FastAPI error bodies ({detail: string} or validation list) into a readable message. */
function detailFrom(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string }).msg ?? 'Invalid request').join('; ')
  }
  if (status === 0 || (status >= 502 && status <= 504)) return UNREACHABLE
  return `Request failed (${status})`
}

/** fetch() that reports network failures as ApiError instead of a bare TypeError. */
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url(path), init)
  } catch (err) {
    if (init?.signal?.aborted) throw err
    throw new ApiError(UNREACHABLE, 0)
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Non-JSON error body (e.g. proxy error page)
  }
  return new ApiError(detailFrom(body, res.status), res.status)
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const res = await request('/health', { signal })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}

/** Upload via XHR because fetch() has no upload progress events. Progress is 0..1. */
export function uploadPdf(file: File, onProgress: (fraction: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url('/documents'))
    xhr.responseType = 'json'

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as UploadResult)
      else reject(new ApiError(detailFrom(xhr.response, xhr.status), xhr.status))
    }
    xhr.onerror = () => reject(new ApiError(UNREACHABLE, 0))

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export interface StreamHandlers {
  onSources: (sources: Source[]) => void
  onToken: (text: string) => void
}

/**
 * POST /api/ask/stream and dispatch SSE events to handlers.
 * Resolves on `done`; rejects with ApiError on `error` or HTTP failure; rejects with AbortError when aborted.
 */
export async function askStream(query: string, handlers: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const res = await request('/ask/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ query }),
    signal,
  })
  if (!res.ok) throw await toApiError(res)
  if (!res.body) throw new ApiError('Streaming not supported by this browser', 0)

  let finished = false
  let failure: ApiError | null = null

  const parser = createSseParser(({ event, data }) => {
    const payload = JSON.parse(data)
    if (event === 'sources') handlers.onSources(payload as Source[])
    else if (event === 'token') handlers.onToken((payload as { t: string }).t)
    else if (event === 'done') finished = true
    else if (event === 'error') failure = new ApiError(detailFrom(payload, 500), 500)
  })

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  while (!finished && !failure) {
    const { value, done } = await reader.read()
    if (done) break
    parser.push(value)
  }
  reader.releaseLock()

  if (failure) throw failure
  if (!finished) throw new ApiError('Connection closed before the answer finished', 0)
}
