import { useRef, useState, type DragEvent } from 'react'
import { MAX_UPLOAD_MB, uploadPdf, type UploadResult } from '../api/client'
import type { UploadRun } from '../howItWorks/strip'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: string; progress: number }
  | { phase: 'processing'; file: string }
  | { phase: 'error'; message: string }

interface Props {
  onRun: (run: UploadRun) => void
  /** Chunks already indexed on the server, shown when no guide was uploaded in this session */
  indexedChunks?: number
}

function GuideCard({ name, detail, active }: { name: string; detail: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        active ? 'border-teal-300 bg-teal-50/70' : 'border-slate-200 bg-white'
      }`}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-bold text-rose-600"
      >
        PDF
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-900" title={name}>
          {name}
        </span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
    </div>
  )
}

/** Picking a PDF uploads and indexes it straight away; the latest guide is shown as a card. */
export function UploadPanel({ onRun, indexedChunks }: Props) {
  const [guide, setGuide] = useState<UploadResult>()
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = state.phase === 'uploading' || state.phase === 'processing'

  const process = async (file: File) => {
    setState({ phase: 'uploading', file: file.name, progress: 0 })
    onRun({ phase: 'uploading' })
    const started = Date.now()
    let uploadMs: number | undefined
    try {
      const result = await uploadPdf(file, (progress) => {
        // Once bytes are sent the server is still extracting and embedding
        if (progress < 1) return setState({ phase: 'uploading', file: file.name, progress })
        if (uploadMs === undefined) {
          uploadMs = Date.now() - started
          onRun({ phase: 'processing', uploadMs })
        }
        setState({ phase: 'processing', file: file.name })
      })
      // Only the latest upload is shown; it replaces the previous guide card
      setGuide(result)
      setState({ phase: 'idle' })
      onRun({ phase: 'done', uploadMs: uploadMs ?? Date.now() - started, result })
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
      onRun({ phase: 'error', uploadMs })
    }
  }

  const choose = (picked: File | undefined) => {
    if (!picked || busy) return
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setState({ phase: 'error', message: 'Please choose a PDF file' })
      return
    }
    if (MAX_UPLOAD_MB && picked.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setState({ phase: 'error', message: `File exceeds ${MAX_UPLOAD_MB} MB limit` })
      return
    }
    void process(picked)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files[0])
  }

  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Current guide</h2>

      {guide && <GuideCard name={guide.filename} detail={`${guide.pages} pages · ${guide.chunks} chunks · ready`} active />}
      {!guide && !!indexedChunks && (
        <GuideCard name="Indexed guides" detail={`${indexedChunks} chunks · ready`} active />
      )}

      {busy && (
        <div className="space-y-2 rounded-xl border border-teal-200 bg-white px-3 py-2.5" role="status">
          <p className="truncate text-[13px] font-semibold text-slate-900">{state.file}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            {state.phase === 'uploading' ? (
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round(state.progress * 100)}%` }} />
            ) : (
              <div className="h-full w-1/3 animate-pulse bg-teal-600" />
            )}
          </div>
          <p className="text-xs text-slate-500">
            {state.phase === 'uploading'
              ? `Uploading ${Math.round(state.progress * 100)}%`
              : 'Extracting text and building embeddings…'}
          </p>
        </div>
      )}

      {state.phase === 'error' && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
          {state.message}
        </p>
      )}

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
        className={`cursor-pointer rounded-xl border-[1.5px] border-dashed px-3 py-3 text-center text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none ${
          dragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-white/70 hover:border-teal-400 hover:bg-teal-50/40'
        } ${busy ? 'cursor-not-allowed opacity-50' : ''}`}
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
        <span className="text-slate-500">
          Drop a PDF here or <span className="font-medium text-teal-700 underline">browse</span>
        </span>
      </div>
    </section>
  )
}
