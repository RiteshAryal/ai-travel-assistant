import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { QUERY_STEPS } from '../howItWorks/steps'
import { PipelineDiagram } from './PipelineDiagram'

const AUTOPLAY_MS = 4000

export function HowItWorks({ onClose, initialStep = 0 }: { onClose: () => void; initialStep?: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState(initialStep)
  const [playing, setPlaying] = useState(false)
  const last = QUERY_STEPS.length - 1
  const step = QUERY_STEPS[active]

  // showModal gives focus trap, Esc to close and focus return for free.
  // No close() in cleanup: its async "close" event would call onClose after a StrictMode remount.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setActive((i) => {
        if (i >= last) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [playing, last])

  const go = (index: number) => {
    setPlaying(false)
    setActive(Math.min(Math.max(index, 0), last))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(active + 1)
    else if (e.key === 'ArrowLeft') go(active - 1)
  }

  const togglePlay = () => {
    if (!playing && active >= last) setActive(0)
    setPlaying((p) => !p)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="how-it-works-title"
      className="m-auto max-h-[92vh] w-[min(62rem,95vw)] overflow-y-auto rounded-xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="space-y-5 p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="how-it-works-title" className="text-lg font-semibold text-slate-900">
              How it works: answering a question
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Retrieval-Augmented Generation (RAG): find the relevant PDF chunks first, then let the LLM answer from
              them. Click a step or use the arrow keys.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-xl leading-none text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <PipelineDiagram steps={QUERY_STEPS} active={active} onSelect={go} />

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <StepButton onClick={() => go(active - 1)} disabled={active === 0}>
              ← Back
            </StepButton>
            <StepButton onClick={() => go(active + 1)} disabled={active === last}>
              Next →
            </StepButton>
            <StepButton onClick={togglePlay}>{playing ? '⏸ Pause' : '▶ Play'}</StepButton>
          </div>
          <span className="text-xs text-slate-500" aria-live="polite">
            Step {active + 1} of {QUERY_STEPS.length}
          </span>
        </div>

        <section aria-live="polite" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">{step.title.replace(/^\d+\.\s*/, '')}</h3>
          <Field label="What happens">{step.what}</Field>
          <Field label="Why">{step.why}</Field>
          <Field label="Code">
            <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">{step.file}</code>
          </Field>
        </section>
      </div>
    </dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{label}</div>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{children}</p>
    </div>
  )
}

function StepButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
