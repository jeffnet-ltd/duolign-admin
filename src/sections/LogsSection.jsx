import { useState } from 'react'
import { api } from '../api'

// Moved from DevZoneSection.jsx 2026-10-11 -- a tail of the live
// production log, used to be reachable by any logged-in household
// member; no household plausibly needs raw backend logs, so this is
// properly admin-gated now instead.
export default function LogsSection({ token }) {
  const [lines, setLines] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function fetchLogs() {
    setLoading(true)
    setError(null)
    api.admin.logs(token, 200).then(
      (d) => { setLines(d.lines); setLoading(false) },
      (err) => { setError(err.message); setLoading(false) },
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">Logs</h2>
      <button
        type="button" onClick={fetchLogs} disabled={loading}
        className="rounded-lg bg-[var(--surface-alt)] text-[var(--text-muted)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {loading ? 'Loading…' : lines ? 'Refresh' : 'View recent logs'}
      </button>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
      {lines && (
        <pre className="max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2 text-xs text-[var(--text-muted)] whitespace-pre-wrap break-words">
          {lines.length > 0 ? lines.join('') : 'Nothing logged yet.'}
        </pre>
      )}
    </div>
  )
}
