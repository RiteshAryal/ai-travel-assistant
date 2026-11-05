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
import { usePref } from './hooks/usePref'
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
  const [pipelineHidden, togglePipeline] = usePref('livePipelineCollapsed')
  const guideName = uploadRun.phase === 'done' ? uploadRun.result.filename : undefined

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 border-b border-slate-200 bg-white p-4 md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <header className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-xl shadow-sm shadow-teal-900/20"
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
          indexedChunks={health.chunks}
          onRun={(run) => {
            setUploadRun(run)
            if (run.phase === 'done') {
              setUploaded(true)
              health.refresh()
            }
          }}
        />
        <nav aria-label="Learn" className="space-y-0.5">
          <h2 className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Learn</h2>
          <NavButton
            title="How the app works"
            icon={<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />}
            onClick={() => setDialog('usage')}
          />
          <NavButton
            title="How the RAG flow works"
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
          <FurtherReading />
        </nav>
        {health.chunks !== undefined && (
          <p className="mt-auto rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
            Qdrant · {health.chunks} chunks indexed
          </p>
        )}
      </aside>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-5 backdrop-blur">
          {hasGuide && (
            <span className="inline-flex max-w-[40%] items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <span aria-hidden>📄</span>
              <span className="truncate">{guideName ?? 'Indexed guides'}</span>
            </span>
          )}
          <span className="hidden text-sm text-slate-500 lg:inline">
            {hasGuide ? 'Answers cite pages from your guide' : 'No guide yet'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clear}
                disabled={isStreaming}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none disabled:opacity-50"
              >
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={togglePipeline}
              aria-pressed={!pipelineHidden}
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none md:block"
            >
              Pipeline {pipelineHidden ? '◂' : '▸'}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatThread messages={messages} onExample={send} locked={!hasGuide} />
        </div>
        <ChatInput
          isStreaming={isStreaming}
          lockedReason={lockedReason}
          guideName={guideName}
          onSend={send}
          onStop={stop}
        />
      </main>

      <LivePipeline
        messages={messages}
        uploadRun={uploadRun}
        collapsed={pipelineHidden}
        onToggle={togglePipeline}
        onOpen={() => setDialog('rag')}
      />

      {dialog === 'usage' && <HowToUse onClose={() => setDialog(null)} onOpenRag={() => setDialog('rag')} />}
      {dialog === 'rag' && <RagFlow initialStep={live ?? 0} onClose={() => setDialog(null)} />}
    </div>
  )
}

function NavButton({ title, icon, onClick }: { title: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-teal-700"
        aria-hidden
      >
        {icon}
      </svg>
      {title}
    </button>
  )
}
