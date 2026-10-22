import { useEffect, useState } from 'react'
import { api } from '../api'
import Loading from '../components/Loading'

// B2B billing (server/billing_service.py) -- every household that's
// redeemed a voucher. Visible to any admin (not owner-gated, unlike
// admin-account management below): this is ordinary dashboard data,
// not a privilege-escalation surface.
export default function EntitlementsSection({ token, onSessionError }) {
  const [entitlements, setEntitlements] = useState(null)
  const [error, setError] = useState(null)

  function refetch() {
    api.admin.entitlements(token).then((d) => setEntitlements(d.entitlements), onSessionError)
  }

  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(householdId, currentStatus) {
    const next = currentStatus === "active" ? "read_only" : "active"
    setError(null)
    try {
      await api.admin.setEntitlementStatus(token, householdId, next)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  if (entitlements === null) return <Loading inline />

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">B2B entitlements</h2>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
      {entitlements.length === 0 && <p className="text-xs text-[var(--text-faint)]">No voucher-activated households yet.</p>}
      {entitlements.map((e) => (
        <div
          key={e.household_id}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-secondary)] truncate">{e.display_name}</p>
            <p className="text-xs text-[var(--text-faint)] truncate">{e.voucher_code}</p>
            {e.expires_at && (
              <p className="text-xs text-[var(--text-faint)] truncate">
                {new Date(e.expires_at) < new Date() ? 'Expired ' : 'Expires '}
                {new Date(e.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            type="button" onClick={() => handleToggle(e.household_id, e.status)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              e.status === "active"
                ? "bg-[var(--surface-alt)] text-[var(--success-text)]"
                : "bg-[var(--surface-alt)] text-[var(--danger-text)]"
            }`}
          >
            {e.status === "active" ? "Active — tap to set read-only" : "Read-only — tap to reactivate"}
          </button>
        </div>
      ))}
    </div>
  )
}
