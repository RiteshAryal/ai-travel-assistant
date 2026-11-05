import { useState, type ReactNode } from 'react'
import { ChatInput } from './components/ChatInput'
import { ChatThread } from './components/ChatThread'
import { FurtherReading } from './components/FurtherReading'
import { HealthBadge } from './components/HealthBadge'
import { LivePipeline } from './components/LivePipeline'
import { HowToUse } from './components/HowToUse'
import { RagFlow } from './components/RagFlow'
import { UploadPanel } from './components/UploadPanel'
import { useChat } from './hooks/useChat'
import { useHealth } from './hooks/useHealth'
import { liveStep } from './howItWorks/live'
import type { UploadRun } from './howItWorks/strip'

export default function App() {
  const { messages, isStreaming, send, stop, clear } = useChat()
  const health = useHealth()
  // A finished upload unlocks the chat at once, without waiting for the health re-check below
  const [uploaded, setUploaded] = useState(false)
  // Otherwise locked until the server confirms at least one indexed chunk. Unknown (still
  // checking, or offline) counts as locked too, so nothing is clickable before a guide exists.
  const hasGuide = uploaded || (health.chunks ?? 0) > 0
  const lockedReason = hasGuide
    ? undefined
    : health.state === 'checking'
      ? 'Checking backend…'
      : health.state === 'down'
        ? 'Backend offline'
        : 'Upload a travel guide PDF first'
  const [dialog, setDialog] = useState<'usage' | 'rag' | null>(null)
  const [uploadRun, setUploadRun] = useState<UploadRun>({ phase: 'idle' })
  const live = liveStep(messages)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-slate-200 bg-gradient-to-b from-teal-50/70 via-white to-white p-5 md:w-80 md:overflow-y-auto md:border-r md:border-b-0">
        <header className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-xl shadow-sm shadow-teal-900/20"
          >
            🧭
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-base leading-tight font-semibold tracking-tight text-slate-900">
              Travel Assistant
            </h1>
            <HealthBadge state={health.state} />
          </div>
        </header>
        <UploadPanel
          onRun={(run) => {
            setUploadRun(run)
            if (run.phase === 'done') {
              setUploaded(true)
              health.refresh()
            }
          }}
        />
        <hr className="border-slate-200" />
        <div className="space-y-2">
          <HelpCard
            title="How the app works"
            hint="Upload, ask, read the answer"
            icon={<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />}
            onClick={() => setDialog('usage')}
          />
          <HelpCard
            title="How the RAG flow works"
            hint="See how a question becomes an answer"
            icon={
              <>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
              </>
            }
            onClick={() => setDialog('rag')}
          />
        </div>
        <hr className="border-slate-200" />
        <FurtherReading />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            disabled={isStreaming}
            className="mt-auto self-start text-xs text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
          >
            Clear conversation
          </button>
        )}
      </aside>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatThread messages={messages} onExample={send} locked={!hasGuide} />
        </div>
        <div className="border-t border-slate-200 bg-slate-50">
          <ChatInput
            isStreaming={isStreaming}
            lockedReason={lockedReason}
            onSend={send}
            onStop={stop}
          />
        </div>
      </main>

      <LivePipeline messages={messages} uploadRun={uploadRun} onOpen={() => setDialog('rag')} />

      {dialog === 'usage' && <HowToUse onClose={() => setDialog(null)} onOpenRag={() => setDialog('rag')} />}
      {dialog === 'rag' && <RagFlow initialStep={live ?? 0} onClose={() => setDialog(null)} />}
    </div>
  )
}

function HelpCard({
  title,
  hint,
  icon,
  onClick,
}: {
  title: string
  hint: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-teal-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          {icon}
        </svg>
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span aria-hidden className="text-slate-400 transition-transform group-hover:translate-x-0.5">
        ›
      </span>
    </button>
  )
}
