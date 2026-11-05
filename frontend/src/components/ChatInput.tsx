import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface Props {
  isStreaming: boolean
  /** When set, asking is blocked and this text explains why */
  lockedReason?: string
  /** Name of the guide answers come from, shown as a chip in the composer */
  guideName?: string
  onSend: (query: string) => void
  onStop: () => void
}

export function ChatInput({ isStreaming, lockedReason, guideName, onSend, onStop }: Props) {
  const [value, setValue] = useState('')
  const canSend = !!value.trim() && !lockedReason

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (isStreaming || !canSend) return
    onSend(value)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline; ignore while an IME is composing
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-3">
      <form
        onSubmit={submit}
        className={`rounded-2xl border bg-white p-3 shadow-lg shadow-slate-900/5 transition-colors focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-600/15 ${
          lockedReason ? 'border-slate-200 bg-slate-50' : 'border-slate-200'
        }`}
      >
        <label htmlFor="chat-input" className="sr-only">
          Travel question
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!!lockedReason}
          placeholder={lockedReason ?? 'Ask a travel question, e.g. Best places to visit in Paris…'}
          className="block max-h-40 min-h-[32px] w-full resize-none bg-transparent px-1 text-[15px] outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:placeholder:text-slate-500"
        />
        <div className="mt-2 flex items-center gap-2">
          {guideName && !lockedReason && (
            <span className="inline-flex max-w-[60%] items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
              <span aria-hidden>📄</span>
              <span className="truncate">{guideName}</span>
            </span>
          )}
          <span className="ml-auto text-xs text-slate-400">Enter to send · Shift+Enter for a new line</span>
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
            >
              <span aria-hidden className="h-3 w-3 rounded-sm bg-slate-700" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Ask"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white transition-colors hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </form>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">Answers may be incomplete. Check the page citations.</p>
    </div>
  )
}
