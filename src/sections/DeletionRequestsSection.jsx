import { useEffect, useState } from 'react'
import { api } from '../api'
import Loading from '../components/Loading'

// Deletion requests filed from duolign.co.uk without the app (App Store
// review's web-reachable deletion path -- see
// db/migrations/0019_deletion_requests.sql and deletion_request_
// service.py). Not self-service: resolving one here only clears it off
// the queue -- the actual deletion still happens through the normal
// account/household admin tooling, after verifying who's asking.
export default function DeletionRequestsSection({ token, onSessionError }) {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  function refetch() {
    api.admin.deletionRequests(token).then((d) => setRequests(d.requests), onSessionError)
  }

  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResolve(id) {
    setBusyId(id)
    setError(null)
    try {
      await api.admin.resolveDeletionRequest(token, id)
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (requests === null) return <Loading inline />

  const pending = requests.filter((r) => !r.resolved_at)
  const resolved = requests.filter((r) => r.resolved_at)

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">
        Deletion requests{pending.length > 0 ? ` — ${pending.length} pending` : ''}
      </h2>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
      {requests.length === 0 && <p className="text-xs text-[var(--text-faint)]">No deletion requests yet.</p>}
      {pending.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-start justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-secondary)] truncate">{r.email}</p>
            {r.message && <p className="text-xs text-[var(--text-faint)] whitespace-pre-line">{r.message}</p>}
            <p className="text-xs text-[var(--text-faint)]">
              {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button" onClick={() => handleResolve(r.id)} disabled={busyId === r.id}
            className="shrink-0 rounded-lg bg-[var(--surface-alt)] text-[var(--text-muted)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {busyId === r.id ? 'Marking…' : 'Mark resolved'}
          </button>
        </div>
      ))}
      {resolved.length > 0 && (
        <details className="text-xs text-[var(--text-faint)]">
          <summary className="cursor-pointer">{resolved.length} resolved</summary>
          <div className="space-y-1.5 mt-2">
            {resolved.map((r) => (
              <div key={r.id} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5">
                <p className="text-[var(--text-secondary)] truncate">{r.email}</p>
                <p>Resolved by {r.resolved_by} on {new Date(r.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
