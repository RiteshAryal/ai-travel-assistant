import type { HealthState } from '../hooks/useHealth'

const STYLES: Record<HealthState, { dot: string; label: string }> = {
  checking: { dot: 'bg-slate-300', label: 'Checking backend…' },
  ok: { dot: 'bg-emerald-500', label: 'Backend online' },
  degraded: { dot: 'bg-amber-500', label: 'Vector store unreachable' },
  down: { dot: 'bg-rose-500', label: 'Backend offline' },
}

export function HealthBadge({ state }: { state: HealthState }) {
  const { dot, label } = STYLES[state]
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-xs text-slate-600"
      role="status"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === 'ok' ? 'shadow-[0_0_0_3px] shadow-emerald-500/20' : ''}`} aria-hidden />
      {label}
    </div>
  )
}
