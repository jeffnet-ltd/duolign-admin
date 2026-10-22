import { useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'

// Shared pieces for the multi-page dashboard (2026-10-22 rebuild).

export const fmtDate = (iso, withTime = false) => (iso
  ? new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
  : '—')

export function timeAgo(iso) {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-GB'))
export const fmtMoney = (n, currency = 'gbp') => (n == null ? '—' : Number(n).toLocaleString('en-GB', {
  style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: n % 1 ? 2 : 0,
}))

// For the older self-fetching sections: their token, and a 401 handler
// that signs out.
export function useSession() {
  const { token, logout } = useAdmin()
  return { token, onSessionError: (err) => { if (err.status === 401) logout() } }
}

// Fetch one page's data; a 401 signs out, anything else shows on the
// page. `poll` (ms) refetches while the tab is visible.
export function useAdminData(fetcher, deps = [], { poll } = {}) {
  const { token, logout } = useAdmin()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useRef(null)
  load.current = (opts) => {
    setLoading(true)
    return fetcherRef.current(token, opts).then(
      (d) => {
        // An older backend answers unknown routes with the app's HTML,
        // which arrives here as null.
        if (d == null) { setError('The server hasn’t been updated for this page yet. It will work once the latest backend is deployed.'); return }
        setData(d); setError(null); setUpdatedAt(new Date())
      },
      (err) => { if (err.status === 401) logout(); else setError(err.message) },
    ).finally(() => setLoading(false))
  }

  useEffect(() => {
    load.current()
    if (!poll) return undefined
    const id = setInterval(() => { if (document.visibilityState === 'visible') load.current() }, poll)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps])

  return { data, error, loading, updatedAt, reload: (opts) => load.current(opts) }
}

export function PageHeader({ title, subtitle, updatedAt, loading, onRefresh, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onRefresh && (
          <button
            type="button" onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] disabled:opacity-60"
          >
            <RefreshCw size={13} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
          </button>
        )}
      </div>
    </div>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 space-y-3 min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-medium text-[var(--text-primary)]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, sub, tone, onClick }) {
  const toneClass = tone === 'down' ? 'text-[var(--danger-text)]' : tone === 'warn' ? 'text-[var(--warn-text)]'
    : tone === 'ok' ? 'text-[var(--success-text)]' : 'text-[var(--text-primary)]'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined} onClick={onClick}
      className={`rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3.5 text-left min-w-0 ${onClick ? 'hover:border-[var(--text-faint)] transition-colors' : ''}`}
    >
      <p className="text-xs text-[var(--text-muted)] truncate">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-faint)] mt-0.5 truncate">{sub}</p>}
    </Tag>
  )
}

const STATUS = {
  ok: { label: 'Healthy', dot: 'bg-[var(--success-text)]', text: 'text-[var(--success-text)]', bg: 'bg-[var(--success-bg)]' },
  warn: { label: 'Needs a look', dot: 'bg-[var(--warn-text)]', text: 'text-[var(--warn-text)]', bg: 'bg-[var(--warn-bg)]' },
  down: { label: 'Down', dot: 'bg-[var(--danger-text)]', text: 'text-[var(--danger-text)]', bg: 'bg-[var(--danger-bg)]' },
  info: { label: 'Info', dot: 'bg-[var(--info-text)]', text: 'text-[var(--info-text)]', bg: 'bg-[var(--info-bg)]' },
  unconfigured: { label: 'Not connected', dot: 'bg-[var(--text-faint)]', text: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-alt)]' },
}

export function statusStyle(status) {
  return STATUS[status] || STATUS.unconfigured
}

export function StatusDot({ status, pulse = false }) {
  const s = statusStyle(status)
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
      {pulse && status === 'down' && <span className={`absolute inset-0 rounded-full ${s.dot} opacity-60 animate-ping`} />}
      <span className={`relative inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} />
    </span>
  )
}

export function StatusBadge({ status, label }) {
  const s = statusStyle(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <StatusDot status={status} />
      {label || s.label}
    </span>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">{children}</p>
}

export function Empty({ children }) {
  return <p className="text-sm text-[var(--text-faint)]">{children}</p>
}

export function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--info-text)] hover:underline">
      {children} <ExternalLink size={12} strokeWidth={2} />
    </a>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-alt)] p-0.5">
      {options.map((opt) => {
        const [v, label] = Array.isArray(opt) ? opt : [opt, opt]
        return (
          <button
            key={v} type="button" onClick={() => onChange(v)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${value === v ? 'bg-[var(--surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// A plain responsive table: horizontally scrollable on a phone.
export function Table({ columns, rows, empty = 'Nothing here yet.', rowKey }) {
  if (!rows?.length) return <Empty>{empty}</Empty>
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--text-muted)]">
            {columns.map((c) => (
              <th key={c.key} className={`pb-2 pr-4 font-medium whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} className="border-t border-[var(--hairline)]">
              {columns.map((c) => (
                <td key={c.key} className={`py-2 pr-4 align-top text-[var(--text-secondary)] ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
