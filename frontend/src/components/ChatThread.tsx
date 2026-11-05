import { useEffect, useRef } from 'react'
import type { Message } from '../hooks/chatReducer'
import { MessageBubble } from './MessageBubble'

// Deliberately destination-free so they fit any uploaded guide (Paris, London, Rome, ...)
const EXAMPLES = [
  { q: 'What are the best places to visit?', title: 'Best places to visit', hint: 'Top sights from the guide', emoji: '📍' },
  { q: 'Plan a 2-day itinerary', title: 'Plan a 2-day itinerary', hint: 'Morning, afternoon, evening', emoji: '🗓' },
  { q: 'Where should I eat?', title: 'Where should I eat?', hint: 'Local favourites and budgets', emoji: '🍽' },
  { q: 'What is the best time to visit?', title: 'Best time to visit', hint: 'Weather, crowds, events', emoji: '☀️' },
]

interface Props {
  messages: Message[]
  onExample: (query: string) => void
  /** True while no travel guide is indexed: example questions are shown but disabled */
  locked?: boolean
}

export function ChatThread({ messages, onExample, locked }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the newest tokens in view while streaming
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(600px_300px_at_50%_40%,rgb(20_184_166/0.10),transparent_70%)] px-4 pb-6 text-center">
        <div
          aria-hidden
          className="flex h-15 w-15 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-700 to-teal-500 text-3xl shadow-xl shadow-teal-800/25"
        >
          🧭
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Where to next?</h2>
        <p className="text-[15px] text-slate-500">
          {locked
            ? 'Upload a travel guide PDF on the left to get started.'
            : 'Ask anything about your guide. Answers come with page citations.'}
        </p>
        <div className="mt-5 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {EXAMPLES.map(({ q, title, hint, emoji }) => (
            <button
              key={q}
              type="button"
              onClick={() => onExample(q)}
              disabled={locked}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-teal-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-sm"
            >
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-lg">
                {emoji}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" aria-live="polite">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  )
}
