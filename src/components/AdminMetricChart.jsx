import { useId, useMemo } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

// Admin dashboard metrics (docs/ROADMAP.md's "Observability & admin
// dashboard" section) -- a Stripe-dashboard-style card: a big headline
// number + a delta pill, a smooth line over a gradient-fill area below
// it, a handful of date labels, nothing else. Hand-rolled SVG, same
// convention as TrajectoryChart.jsx -- no charting library anywhere in
// this repo (see that file's own comment for why).
//
// Deliberately renders even when every value is 0/None -- "no data
// yet" is a real, expected state before launch, not an error. Shown
// as a flat muted baseline with a centered caption, at the SAME size
// as a real chart would be, so the dashboard's layout doesn't jump
// once real numbers start arriving.
const PADDING = { left: 8, right: 8, top: 8, bottom: 20 }

function pickLabelIndices(n, max = 4) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const step = (n - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => Math.round(i * step))
}

function formatDateLabel(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AdminMetricChart({
  title, value, changePct, series, color = '#38bdf8', height = 90,
}) {
  const clipId = useId()
  const gradientId = useId()
  const width = 320
  const plotW = width - PADDING.left - PADDING.right
  const plotH = height - PADDING.top - PADDING.bottom
  const n = series.length

  const hasData = useMemo(() => series.some((p) => p.value !== null && p.value !== 0), [series])

  const maxValue = useMemo(() => {
    const all = series.map((p) => p.value).filter((v) => v !== null)
    const max = Math.max(1, ...all)
    const magnitude = 10 ** Math.floor(Math.log10(max))
    return Math.ceil((max * 1.15) / magnitude) * magnitude
  }, [series])

  const x = (i) => PADDING.left + (n === 1 ? 0 : (i / (n - 1)) * plotW)
  const y = (v) => PADDING.top + plotH - (Math.max(0, v ?? 0) / maxValue) * plotH
  const baselineY = PADDING.top + plotH
  const labelIndices = useMemo(() => pickLabelIndices(n), [n])

  const linePoints = series.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const areaPoints = `${x(0)},${baselineY} ${linePoints} ${x(n - 1)},${baselineY}`

  const trendTone = changePct == null ? 'flat' : changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat'

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-muted)]">{title}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">{value}</p>
        </div>
        {changePct != null && (
          <span
            className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
              trendTone === 'up' ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                : trendTone === 'down' ? 'bg-[var(--warn-bg)] text-[var(--danger-text)]'
                : 'bg-[var(--surface-alt)] text-[var(--text-faint)]'
            }`}
          >
            {trendTone === 'up' && <TrendingUp size={12} strokeWidth={2.5} />}
            {trendTone === 'down' && <TrendingDown size={12} strokeWidth={2.5} />}
            {Math.abs(changePct)}%
          </span>
        )}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${title} over time`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hasData ? color : 'var(--text-faint)'} stopOpacity="0.28" />
              <stop offset="100%" stopColor={hasData ? color : 'var(--text-faint)'} stopOpacity="0" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x={PADDING.left} y={PADDING.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          <line x1={PADDING.left} x2={width - PADDING.right} y1={baselineY} y2={baselineY}
            stroke="var(--surface-border)" strokeWidth="1" />

          <g clipPath={`url(#${clipId})`}>
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />
            <polyline points={linePoints} fill="none"
              stroke={hasData ? color : 'var(--text-faint)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={hasData ? undefined : '3 3'} />
          </g>

          {labelIndices.map((i) => (
            <text key={i} x={x(i)} y={height - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="text-[0.6rem]" fill="var(--text-faint)">
              {formatDateLabel(series[i].date)}
            </text>
          ))}
        </svg>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pb-5">
            <span className="text-xs text-[var(--text-faint)] bg-[var(--surface)] px-2">No data yet</span>
          </div>
        )}
      </div>
    </div>
  )
}
