import { useState } from 'react'
import { ChatInput } from './components/ChatInput'
import { ChatThread } from './components/ChatThread'
import { HealthBadge } from './components/HealthBadge'
import { LivePipeline } from './components/LivePipeline'
import { HowItWorks } from './components/HowItWorks'
import { UploadPanel } from './components/UploadPanel'
import { useChat } from './hooks/useChat'
import { useHealth } from './hooks/useHealth'
import { liveStep } from './howItWorks/live'
import type { UploadRun } from './howItWorks/strip'

export default function App() {
  const { messages, isStreaming, send, stop, clear } = useChat()
  const health = useHealth()
  const [showHelp, setShowHelp] = useState(false)
  const [uploadRun, setUploadRun] = useState<UploadRun>({ phase: 'idle' })
  const live = liveStep(messages)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-slate-200 bg-white p-5 md:w-80 md:border-r md:border-b-0">
        <header className="space-y-1">
          <h1 className="text-base font-semibold text-slate-900">🧭 AI Travel Itinerary Assistant</h1>
          <HealthBadge state={health} />
        </header>
        <UploadPanel onRun={setUploadRun} />
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-2 self-start rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <span aria-hidden>ⓘ</span> How it works
        </button>
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
        <LivePipeline messages={messages} uploadRun={uploadRun} onOpen={() => setShowHelp(true)} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatThread messages={messages} onExample={send} />
        </div>
        <div className="border-t border-slate-200 bg-slate-50">
          <ChatInput isStreaming={isStreaming} onSend={send} onStop={stop} />
        </div>
      </main>

      {showHelp && <HowItWorks initialStep={live ?? 0} onClose={() => setShowHelp(false)} />}
    </div>
  )
}
