import type { KeyboardEvent } from 'react'
import { edgePath } from '../howItWorks/geometry'
import { DIAGRAM_H, DIAGRAM_W, NODE_H, NODE_W, type PipelineStep } from '../howItWorks/steps'

interface Props {
  steps: PipelineStep[]
  active: number
  onSelect: (index: number) => void
}

export function PipelineDiagram({ steps, active, onSelect }: Props) {
  const activate = (e: KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(index)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
      className="w-full"
      role="group"
      aria-label="Query pipeline: six steps from question to streamed answer"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
        </marker>
      </defs>

      {steps.slice(1).map((step, i) => {
        // Edge i links steps[i] -> step; it is "live" while the step it feeds is selected
        const state = i + 1 === active ? 'live' : i + 1 < active ? 'done' : 'todo'
        const color = state === 'todo' ? 'text-slate-300' : 'text-teal-600'
        return (
          <path
            key={step.id}
            d={edgePath(steps[i], step)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            markerEnd="url(#arrow)"
            className={`${color} ${state === 'live' ? 'pipeline-edge-live' : ''}`}
          />
        )
      })}

      {steps.map((step, i) => {
        const isActive = i === active
        const reached = i < active
        const box = isActive
          ? 'fill-teal-50 stroke-teal-600'
          : reached
            ? 'fill-white stroke-teal-300'
            : 'fill-white stroke-slate-300'
        return (
          <g
            key={step.id}
            transform={`translate(${step.x} ${step.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${step.title}, ${step.tech}`}
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => activate(e, i)}
            className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3] [&:focus-visible>rect]:stroke-teal-700"
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={12}
              strokeWidth={isActive ? 3 : 1.5}
              className={`${box} transition-colors ${isActive ? 'pipeline-node-active' : ''}`}
            />
            <text x={NODE_W / 2} y={32} textAnchor="middle" className="fill-slate-900 text-[17px] font-semibold">
              {step.title}
            </text>
            <text x={NODE_W / 2} y={54} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {step.tech}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
