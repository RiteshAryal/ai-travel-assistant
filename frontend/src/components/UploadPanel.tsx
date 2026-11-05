import { useRef, useState, type DragEvent } from 'react'
import { MAX_UPLOAD_MB, uploadPdf, type UploadResult } from '../api/client'
import type { UploadRun } from '../howItWorks/strip'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number }
  | { phase: 'processing' }
  | { phase: 'done'; result: UploadResult }
  | { phase: 'error'; message: string }

export function UploadPanel({ onRun }: { onRun: (run: UploadRun) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = state.phase === 'uploading' || state.phase === 'processing'

  const choose = (picked: File | undefined) => {
    if (!picked) return
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setFile(null)
      setState({ phase: 'error', message: 'Please choose a PDF file' })
      return
    }
    if (MAX_UPLOAD_MB && picked.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setFile(null)
      setState({ phase: 'error', message: `File exceeds ${MAX_UPLOAD_MB} MB limit` })
      return
    }
    setFile(picked)
    setState({ phase: 'idle' })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!busy) choose(e.dataTransfer.files[0])
  }

  const process = async () => {
    if (!file) return
    setState({ phase: 'uploading', progress: 0 })
    onRun({ phase: 'uploading' })
    const started = Date.now()
    let uploadMs: number | undefined
    try {
      const result = await uploadPdf(file, (progress) => {
        // Once bytes are sent the server is still extracting and embedding
        if (progress < 1) return setState({ phase: 'uploading', progress })
        if (uploadMs === undefined) {
          uploadMs = Date.now() - started
          onRun({ phase: 'processing', uploadMs })
        }
        setState({ phase: 'processing' })
      })
      setState({ phase: 'done', result })
      onRun({ phase: 'done', uploadMs: uploadMs ?? Date.now() - started, result })
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
      onRun({ phase: 'error', uploadMs })
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Travel guides</h2>
        <p className="mt-1 text-sm text-slate-600">Upload a PDF guide to answer questions from it.</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-2 text-center text-sm transition-colors ${
          dragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-white/70 hover:border-teal-400 hover:bg-teal-50/40'
        } ${busy ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span
          aria-hidden
          className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-lg text-teal-700"
        >
          {file ? '📄' : '⬆'}
        </span>
        {file ? (
          <span className="font-medium break-all text-slate-800">{file.name}</span>
        ) : (
          <span className="text-slate-500">
            Drop a PDF here or <span className="font-medium text-teal-700">browse</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={process}
        disabled={!file || busy}
        className="w-full rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
      >
        {busy ? 'Processing…' : 'Process guide'}
      </button>

      {state.phase === 'uploading' && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-500">Uploading {Math.round(state.progress * 100)}%</p>
        </div>
      )}
      {state.phase === 'processing' && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/3 animate-pulse bg-teal-600" />
          </div>
          <p className="text-xs text-slate-500">Extracting text and building embeddings…</p>
        </div>
      )}
      {state.phase === 'done' && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.result.filename}: {state.result.pages} pages, {state.result.chunks} chunks indexed.
        </p>
      )}
      {state.phase === 'error' && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          {state.message}
        </p>
      )}
    </section>
  )
}
