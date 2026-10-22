import { useMemo } from 'react'

// Bar charts and sparklines for the dashboard (2026-10-22). Hand-rolled
// like AdminMetricChart -- no charting library in this repo.

// Vertical bars over time. `series`: [{label, value}] or, stacked,
// [{label, parts: {name: value}}] with `stack` naming the parts in order
// and `colors` theirs.
export function Bars({ series, stack, colors = ['#38bdf8'], height = 120, format = (v) => v, labelEvery }) {
  const totals = series.map((p) => (stack ? stack.reduce((t, k) => t + (p.parts?.[k] || 0), 0) : p.value || 0))
  const max = Math.max(1, ...totals)
  const every = labelEvery || Math.max(1, Math.ceil(series.length / 6))
  const empty = totals.every((t) => !t)
  return (
    <div className="space-y-1.5">
      {stack && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {stack.map((name, i) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-end gap-[2px]" style={{ height }}>
          {series.map((p, i) => (
            <div
              key={p.label} className="flex-1 min-w-0 flex flex-col-reverse rounded-t-sm overflow-hidden h-full justify-start"
              title={`${p.label}: ${format(totals[i])}`}
            >
              {(stack || ['value']).map((k, j) => {
                const v = stack ? (p.parts?.[k] || 0) : (p.value || 0)
                return v > 0 ? (
                  <span key={k} style={{ height: `${(v / max) * 100}%`, backgroundColor: colors[j % colors.length] }} />
                ) : null
              })}
              {!totals[i] && <span className="h-px bg-[var(--surface-alt)]" />}
            </div>
          ))}
        </div>
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-[var(--text-faint)] bg-[var(--surface)] px-2">No data yet</span>
          </div>
        )}
      </div>
      <div className="flex gap-[2px]">
        {series.map((p, i) => (
          <span key={p.label} className="flex-1 min-w-0 text-[0.65rem] text-[var(--text-faint)] text-center whitespace-nowrap overflow-visible">
            {i % every === 0 ? p.short || p.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ values, color = '#f87171', width = 96, height = 24 }) {
  const points = useMemo(() => {
    if (!values?.length) return ''
    const max = Math.max(1, ...values)
    return values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`).join(' ')
  }, [values, width, height])
  if (!values?.length) return null
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// Horizontal bars, largest first -- funnels and breakdowns.
export function HBars({ items, color = '#6366f1', format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0))
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-[var(--text-secondary)] min-w-0 truncate">{item.label}</span>
            <span className="font-medium text-[var(--text-primary)] tabular-nums shrink-0">{format(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--ring-track)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${((item.value || 0) / max) * 100}%`, backgroundColor: item.color || color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const hourLabel = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
