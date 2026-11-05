import type { ReactNode } from 'react'

// Simple 24px stroke icons (Lucide-style) so every glyph shares one weight and colour
const ICONS = {
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </>
  ),
  paper: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  layers: <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  nodes: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" />
    </>
  ),
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  file: <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5zM14 2v6h6" />,
  pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  terminal: <path d="m4 17 6-6-6-6M12 19h8" />,
}

type IconName = keyof typeof ICONS

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {ICONS[name] as ReactNode}
    </svg>
  )
}

const GROUPS: {
  title: string
  icon: IconName
  links: { label: string; href: string; icon: IconName }[]
}[] = [
  {
    title: 'Concepts',
    icon: 'book',
    links: [
      { label: 'RAG (original paper)', href: 'https://arxiv.org/abs/2005.11401', icon: 'paper' },
      { label: 'What is a vector database?', href: 'https://qdrant.tech/articles/what-is-a-vector-database/', icon: 'layers' },
      { label: 'Sentence embeddings', href: 'https://www.sbert.net', icon: 'nodes' },
    ],
  },
  {
    title: 'Tools',
    icon: 'wrench',
    links: [
      { label: 'Qdrant docs', href: 'https://qdrant.tech/documentation/', icon: 'database' },
      { label: 'FastAPI', href: 'https://fastapi.tiangolo.com', icon: 'zap' },
      { label: 'PyMuPDF (PDF text)', href: 'https://pymupdf.readthedocs.io', icon: 'file' },
      { label: 'Streaming with SSE', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events', icon: 'pulse' },
    ],
  },
  {
    title: 'Get an API key',
    icon: 'key',
    links: [
      { label: 'OpenAI API key', href: 'https://platform.openai.com/api-keys', icon: 'key' },
      { label: 'Gemini API key', href: 'https://aistudio.google.com/app/apikey', icon: 'key' },
      { label: 'Ollama (run locally)', href: 'https://ollama.com', icon: 'terminal' },
    ],
  },
]

export function FurtherReading() {
  return (
    <section className="space-y-1">
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Further reading</h2>
      {GROUPS.map((group) => (
        <details key={group.title} className="group/section rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors select-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Icon name={group.icon} className="h-4 w-4 text-teal-700" />
              <span>
                {group.title} <span className="text-xs font-normal text-slate-400">· {group.links.length}</span>
              </span>
            </span>
            <span
              aria-hidden
              className="text-slate-400 transition-transform group-open/section:rotate-90"
            >
              ›
            </span>
          </summary>
          <ul className="mt-0.5 mb-1 space-y-0.5 border-l border-slate-200 pl-2 ml-3">
            {group.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <Icon name={link.icon} className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600" />
                    {link.label}
                  </span>
                  <span aria-hidden className="text-xs text-slate-300 group-hover:text-teal-600">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
