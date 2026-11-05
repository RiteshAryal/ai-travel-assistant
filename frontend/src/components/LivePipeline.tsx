import type { Message } from '../hooks/chatReducer'
import { QUERY_STEPS, UPLOAD_STEPS, type StripStep } from '../howItWorks/steps'
import { formatMs, queryRow, uploadRow, type ChipState, type StripRow, type UploadRun } from '../howItWorks/strip'

interface Props {
  messages: Message[]
  uploadRun: UploadRun
  onOpen: () => void
}

/**
 * Always-visible progress strip with one row for PDF upload and one for the latest
 * question. Each step shows how long it took once done and explains itself on hover
 * or keyboard focus.
 */
export function LivePipeline({ messages, uploadRun, onOpen }: Props) {
  return (
    <div className="space-y-1.5 border-b border-slate-200 bg-white px-4 py-2 text-xs">
      <Row label="Upload" steps={UPLOAD_STEPS} row={uploadRow(uploadRun)} />
      <Row label="Ask" steps={QUERY_STEPS} row={queryRow(messages)} onOpen={onOpen} />
    </div>
  )
}

function Row({ label, steps, row, onOpen }: { label: string; steps: StripStep[]; row: StripRow; onOpen?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-14 shrink-0 font-semibold ${row.live ? 'text-teal-700' : 'text-slate-400'}`}>{label}</span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1" aria-label={`${label} pipeline progress`}>
        {steps.map((step, i) => (
          <Chip key={step.id} step={step} chip={row.chips[i]} />
        ))}
        {row.totalMs !== undefined && (
          <li className="font-medium text-slate-500" title="Total time">
            Total {formatMs(row.totalMs)}
          </li>
        )}
      </ol>
      {onOpen && (
        <button type="button" onClick={onOpen} className="text-slate-500 underline hover:text-slate-700">
          Explain
        </button>
      )}
    </div>
  )
}

const CHIP_STYLE: Record<ChipState['status'], string> = {
  todo: 'bg-slate-100 text-slate-500',
  active: 'live-step-active bg-teal-600 font-medium text-white',
  done: 'bg-teal-50 text-teal-700',
}

function Chip({ step, chip }: { step: StripStep; chip: ChipState }) {
  const tipId = `live-tip-${step.id}`
  return (
    <li className="group relative" aria-current={chip.status === 'active' ? 'step' : undefined}>
      <span
        tabIndex={0}
        aria-describedby={tipId}
        className={`block cursor-help rounded-full px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${CHIP_STYLE[chip.status]}`}
      >
        {step.title}
        {chip.ms !== undefined && <span className="ml-1.5 font-semibold tabular-nums">{formatMs(chip.ms)}</span>}
      </span>
      <div
        id={tipId}
        role="tooltip"
        className="invisible absolute top-full left-0 z-20 mt-2 w-72 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <div className="font-semibold text-slate-900">{step.title.replace(/^\d+\.\s*/, '')}</div>
        {chip.ms !== undefined && (
          <p className="font-medium text-teal-700">
            Took {formatMs(chip.ms)}
            {chip.note && <span className="font-normal text-slate-500">. {chip.note}</span>}
          </p>
        )}
        <p className="leading-relaxed">{step.what}</p>
        <p className="leading-relaxed text-slate-500">{step.why}</p>
        <code className="block text-[11px] text-slate-500">{step.file}</code>
      </div>
    </li>
  )
}
