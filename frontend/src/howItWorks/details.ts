import type { Message } from '../hooks/chatReducer'
import { formatMs, type UploadRun } from './strip'

/** What went into and came out of one pipeline step, as short text for the details panel. */
export interface StepDetail {
  in: string
  out: string
  /** Long text (e.g. the full prompt), shown in a scrollable block */
  body?: string
}

export type DetailMap = Record<string, StepDetail>

const quote = (s: string, max = 80) => `"${s.length > max ? `${s.slice(0, max)}…` : s}"`

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Details for the latest question, keyed by QUERY_STEPS id. Steps without data yet are omitted. */
export function askDetails(messages: Message[]): DetailMap {
  const index = messages.findLastIndex((m) => m.role === 'assistant')
  if (index === -1) return {}
  const answer = messages[index]
  const question = messages[index - 1]?.content ?? ''
  const t = answer.trace
  const d: DetailMap = {
    question: {
      in: `POST /api/ask/stream {"query": ${quote(question, 60)}}`,
      out: answer.sources ? '200 text/event-stream' : 'waiting for response…',
    },
  }
  if (t) {
    d.embed = {
      in: `${quote(t.embed.query)} → ${t.embed.model}`,
      out: `${t.embed.dim}-dim vector in ${formatMs(t.embed.ms)}`,
    }
    d.search = {
      in: `${t.search.collection}, top ${t.search.top_k}, cosine`,
      out: t.search.hits
        .map((h) => `p.${h.page + 1} ${h.source} ${h.score.toFixed(3)} ${quote(h.text.replace(/\s+/g, ' '), 50)}`)
        .join('\n'),
    }
    d.prompt = {
      in: `${t.prompt.chunks} chunks + question`,
      out: `${t.prompt.chars} chars`,
      body: t.prompt.text,
    }
    d.llm = {
      in: `${t.llm.provider} / ${t.llm.model}`,
      out: answer.content ? `${answer.content.length} chars so far` : 'waiting for first token…',
    }
  }
  if (answer.sources) {
    d.stream = {
      in: 'events: sources, trace, token…, done',
      out: `${answer.sources.length} sources, answer ${answer.content.length} chars, ${answer.status}`,
    }
  }
  return d
}

/** Details for the latest upload, keyed by UPLOAD_STEPS id. Only available once the upload finished. */
export function uploadDetails(run: UploadRun): DetailMap {
  if (run.phase !== 'done') return {}
  const { result } = run
  const t = result.trace
  if (!t) return {}
  return {
    upload: {
      in: `POST /api/documents multipart file=${result.filename} (${formatBytes(t.extract.bytes)})`,
      out: `200 {pages: ${result.pages}, chunks: ${result.chunks}}`,
    },
    extract: { in: `${formatBytes(t.extract.bytes)} PDF`, out: `${t.extract.pages} pages, ${t.extract.chars} chars` },
    chunk: {
      in: `size ${t.chunk.size}, overlap ${t.chunk.overlap}`,
      out: `${t.chunk.count} chunks, first: ${quote(t.chunk.first.replace(/\s+/g, ' '), 60)}`,
    },
    'embed-chunks': { in: `${t.embed.count} texts → ${t.embed.model}`, out: `${t.embed.count} × ${t.embed.dim}-dim vectors` },
    store: { in: `collection ${t.store.collection}`, out: `${t.store.points} points, first id ${t.store.first_id}` },
  }
}
