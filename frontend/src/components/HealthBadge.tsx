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
    <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </div>
  )
}
