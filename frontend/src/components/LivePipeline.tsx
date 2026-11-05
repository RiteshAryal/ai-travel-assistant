import { useState } from 'react'
import type { Message } from '../hooks/chatReducer'
import { askDetails, uploadDetails, type DetailMap, type StepDetail } from '../howItWorks/details'
import { QUERY_STEPS, UPLOAD_STEPS, type StripStep } from '../howItWorks/steps'
import { formatMs, queryRow, uploadRow, type ChipState, type StripRow, type UploadRun } from '../howItWorks/strip'

interface Props {
  messages: Message[]
  uploadRun: UploadRun
  onOpen: () => void
}

const COLLAPSED_KEY = 'livePipelineCollapsed'

/** Boolean preference in localStorage; falls back to false (and stays in memory) when storage is unavailable. */
function usePref(key: string): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setValue((v) => {
      try {
        localStorage.setItem(key, v ? '0' : '1')
      } catch {
        /* storage unavailable: preference just won't persist */
      }
      return !v
    })
  return [value, toggle]
}

type GroupKey = 'upload' | 'ask'

/** Small chevron that points right when closed and rotates down when open. */
function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  )
}

/**
 * Right-hand progress panel with two independent sections: PDF upload and the latest
 * question. Each section collapses on its own, and within a section one step at a time
 * can expand to show its In/Out. Steps also explain themselves on hover or keyboard focus.
 * Hidden below the `md` breakpoint; the whole panel collapses on wider screens.
 */
export function LivePipeline({ messages, uploadRun, onOpen }: Props) {
  const [collapsed, toggle] = usePref(COLLAPSED_KEY)
  // Section state is per group, so opening or closing one never affects the other
  const [sectionOpen, setSectionOpen] = useState<Record<GroupKey, boolean>>({ upload: true, ask: true })
  const [openStep, setOpenStep] = useState<Record<GroupKey, string | null>>({ upload: null, ask: null })

  const toggleSection = (g: GroupKey) => setSectionOpen((cur) => ({ ...cur, [g]: !cur[g] }))
  const toggleStep = (g: GroupKey, id: string) => setOpenStep((cur) => ({ ...cur, [g]: cur[g] === id ? null : id }))
  // An expanded step makes the panel scrollable, which would clip hover tooltips
  const anyStepOpen = (['upload', 'ask'] as const).some((g) => sectionOpen[g] && openStep[g] !== null)

  if (collapsed) {
    return (
      <aside className="hidden shrink-0 border-l border-slate-200 bg-white p-2 md:block">
        <button
          type="button"
          onClick={toggle}
          aria-label="Show pipeline panel"
          title="Show pipeline"
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
        >
          ◀
        </button>
      </aside>
    )
  }

  return (
    <aside
      className={`hidden min-h-0 shrink-0 flex-col gap-3 border-l border-slate-200 bg-white p-4 text-xs md:flex md:w-80 ${anyStepOpen ? 'overflow-y-auto' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Pipeline logs</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpen} className="text-slate-500 underline hover:text-slate-700">
            Explain
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Hide pipeline panel"
            title="Hide pipeline"
            className="rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-slate-100"
          >
            ▶
          </button>
        </div>
      </div>
      <Group
        id="upload"
        label="Upload"
        steps={UPLOAD_STEPS}
        row={uploadRow(uploadRun)}
        details={uploadDetails(uploadRun)}
        expanded={sectionOpen.upload}
        onToggleSection={() => toggleSection('upload')}
        openStep={openStep.upload}
        onToggleStep={(id) => toggleStep('upload', id)}
        tooltips={!anyStepOpen}
      />
      <Group
        id="ask"
        label="Ask"
        steps={QUERY_STEPS}
        row={queryRow(messages)}
        details={askDetails(messages)}
        expanded={sectionOpen.ask}
        onToggleSection={() => toggleSection('ask')}
        openStep={openStep.ask}
        onToggleStep={(id) => toggleStep('ask', id)}
        tooltips={!anyStepOpen}
      />
    </aside>
  )
}

interface GroupProps {
  id: GroupKey
  label: string
  steps: StripStep[]
  row: StripRow
  details: DetailMap
  expanded: boolean
  onToggleSection: () => void
  openStep: string | null
  onToggleStep: (id: string) => void
  tooltips: boolean
}

/** One self-contained card: a clickable header (name, status, chevron) above its step list. */
function Group({ id, label, steps, row, details, expanded, onToggleSection, openStep, onToggleStep, tooltips }: GroupProps) {
  const done = row.chips.filter((c) => c.status === 'done').length
  const status = row.live ? 'Running' : row.totalMs !== undefined ? `Total ${formatMs(row.totalMs)}` : done > 0 ? `${done}/${steps.length} done` : 'Idle'
  const bodyId = `live-section-${id}`

  return (
    <section className={`rounded-xl border bg-white ${row.live ? 'border-teal-300' : 'border-slate-200'}`}>
      <h3>
        <button
          type="button"
          onClick={onToggleSection}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 ${expanded ? 'rounded-t-xl' : 'rounded-xl'}`}
        >
          <Chevron open={expanded} className="text-slate-400" />
          <span className={`text-sm font-semibold ${row.live ? 'text-teal-700' : 'text-slate-800'}`}>{label}</span>
          <span className="ml-auto flex items-center gap-1.5 font-medium text-slate-500">
            {row.live && <span aria-hidden className="live-step-active size-1.5 rounded-full bg-teal-600" />}
            {status}
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!expanded} className="border-t border-slate-100 p-2">
        <ol className="space-y-1" aria-label={`${label} pipeline progress`}>
          {steps.map((step, i) => (
            <Chip
              key={step.id}
              step={step}
              chip={row.chips[i]}
              detail={details[step.id]}
              open={openStep === step.id}
              tooltips={tooltips}
              onToggle={() => onToggleStep(step.id)}
            />
          ))}
        </ol>
      </div>
    </section>
  )
}

const CHIP_STYLE: Record<ChipState['status'], string> = {
  todo: 'bg-slate-100 text-slate-500',
  active: 'live-step-active bg-teal-600 font-medium text-white',
  done: 'bg-teal-50 text-teal-700',
}

interface ChipProps {
  step: StripStep
  chip: ChipState
  detail?: StepDetail
  open: boolean
  /** Hover tooltips are off while a step is open: the panel then scrolls, which would clip them */
  tooltips: boolean
  onToggle: () => void
}

function Chip({ step, chip, detail, open, tooltips, onToggle }: ChipProps) {
  const tipId = `live-tip-${step.id}`
  const panelId = `live-detail-${step.id}`
  return (
    <li className="group relative" aria-current={chip.status === 'active' ? 'step' : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={tipId}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${CHIP_STYLE[chip.status]}`}
      >
        <span className="flex items-center gap-1.5">
          <Chevron open={open} className="opacity-70" />
          {step.title}
        </span>
        {chip.ms !== undefined && <span className="font-semibold tabular-nums">{formatMs(chip.ms)}</span>}
      </button>
      <div
        id={tipId}
        role="tooltip"
        hidden={!tooltips}
        className="invisible absolute top-0 right-full z-20 mr-3 w-72 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
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
      <div id={panelId} hidden={!open}>
        {open && <Detail detail={detail} />}
      </div>
    </li>
  )
}

function Detail({ detail }: { detail?: StepDetail }) {
  if (!detail) {
    return <p className="mt-1 mb-2 rounded-md bg-slate-50 p-2 text-slate-500">No data yet. Run this pipeline to see it.</p>
  }
  return (
    <dl className="mt-1 mb-2 space-y-1 rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-snug text-slate-600">
      <div>
        <dt className="font-sans font-semibold text-slate-400">In</dt>
        <dd className="break-words whitespace-pre-wrap">{detail.in}</dd>
      </div>
      <div>
        <dt className="font-sans font-semibold text-slate-400">Out</dt>
        <dd className="break-words whitespace-pre-wrap">{detail.out}</dd>
      </div>
      {detail.body && (
        <dd>
          <pre className="max-h-40 overflow-auto rounded border border-slate-200 bg-white p-1.5 break-words whitespace-pre-wrap">
            {detail.body}
          </pre>
        </dd>
      )}
    </dl>
  )
}
