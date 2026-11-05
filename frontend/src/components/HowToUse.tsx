import { Modal } from './Modal'

const STEPS = [
  {
    title: 'Upload a guide',
    body: 'In the left panel, drop a travel guide PDF (or browse) and press “Process guide”. Wait for the “chunks indexed” message.',
  },
  {
    title: 'Ask a question',
    body: 'Type it in the box at the bottom of the chat, or click an example. Questions unlock once a guide is indexed.',
  },
  {
    title: 'Read the answer',
    body: 'The answer streams in word by word, with the PDF pages it came from. Watch the live strip to see each stage.',
  },
]

export function HowToUse({ onClose, onOpenRag }: { onClose: () => void; onOpenRag: () => void }) {
  return (
    <Modal
      titleId="how-to-use-title"
      title="How to use the app"
      subtitle="Three steps from a PDF to a sourced answer."
      onClose={onClose}
    >
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white"
            >
              {i + 1}
            </span>
            <div>
              <div className="font-semibold text-slate-900">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm text-slate-500">
        Curious what happens behind the scenes?{' '}
        <button type="button" onClick={onOpenRag} className="font-medium text-teal-700 underline hover:text-teal-800">
          See how the RAG flow works
        </button>
        .
      </p>
    </Modal>
  )
}
