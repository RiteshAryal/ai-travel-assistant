import { useEffect, useRef } from 'react'
import type { Message } from '../hooks/chatReducer'
import { MessageBubble } from './MessageBubble'

// Deliberately destination-free so they fit any uploaded guide (Paris, London, Rome, ...)
const GENERIC_QUESTIONS = [
  'What are the best places to visit?',
  'Plan a 2-day itinerary',
  'Where should I eat?',
  'What is the best time to visit?',
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
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-4xl" aria-hidden>
          🧭
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ask about any destination</h2>
          <p className="text-sm text-slate-500">
            {locked
              ? 'Upload a travel guide PDF on the left to get started.'
              : 'Answers come from the travel guides you upload.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {GENERIC_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onExample(q)}
              disabled={locked}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
            >
              {q}
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
