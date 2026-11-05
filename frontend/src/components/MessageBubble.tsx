import Markdown from 'react-markdown'
import type { Source } from '../api/client'
import type { Message } from '../hooks/chatReducer'

/** One chip per (file, page); backend pages are 0-based. */
function uniquePages(sources: Source[]) {
  const seen = new Set<string>()
  return sources.filter((s) => {
    const key = `${s.source}:${s.page}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 whitespace-pre-wrap text-white">
          {message.content}
        </div>
      </div>
    )
  }

  const waiting = message.status === 'streaming' && !message.content

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {waiting ? (
          <p className="animate-pulse text-sm text-slate-400">Searching guides…</p>
        ) : (
          message.content && (
          <div className="markdown leading-relaxed">
            <Markdown>{message.content}</Markdown>
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-slate-400 align-middle" />
            )}
          </div>
          )
        )}

        {message.status === 'stopped' && <p className="text-xs text-slate-400">Stopped.</p>}
        {message.status === 'error' && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {message.error}
          </p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
            {uniquePages(message.sources).map((s) => (
              <span
                key={`${s.source}:${s.page}`}
                title={`Relevance ${s.score.toFixed(2)}`}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
              >
                {s.source} · p.{s.page + 1}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
