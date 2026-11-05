import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface Props {
  isStreaming: boolean
  onSend: (query: string) => void
  onStop: () => void
}

export function ChatInput({ isStreaming, onSend, onStop }: Props) {
  const [value, setValue] = useState('')

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (isStreaming || !value.trim()) return
    onSend(value)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline; ignore while an IME is composing
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-3">
      <label htmlFor="chat-input" className="sr-only">
        Travel question
      </label>
      <textarea
        id="chat-input"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask a travel question, e.g. Best places to visit in Paris"
        className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          className="h-11 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Ask
        </button>
      )}
    </form>
  )
}
