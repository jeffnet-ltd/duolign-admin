import { useEffect, useState } from 'react'
import { api } from '../api'
import Loading from '../components/Loading'

// Freemium tier (migration 0017, 2026-10-09) -- EVERY household, not
// just B2B-voucher ones (see EntitlementsSection below for those).
// This is how a household with no voucher at all gets marked 'paid'
// for testing, and how an admin can flip any household between tiers
// live to see both experiences -- the whole reason this exists.
export default function HouseholdTiersSection({ token, onSessionError }) {
  const [households, setHouseholds] = useState(null)
  const [error, setError] = useState(null)

  function refetch() {
    api.admin.householdTiers(token).then((d) => setHouseholds(d.households), onSessionError)
  }

  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(householdId, currentTier) {
    const next = currentTier === "paid" ? "free" : "paid"
    setError(null)
    try {
      await api.admin.setHouseholdTier(token, householdId, next)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  if (households === null) return <Loading inline />

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">Household tiers</h2>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
      {households.length === 0 && <p className="text-xs text-[var(--text-faint)]">No households yet.</p>}
      {households.map((h) => (
        <div
          key={h.household_id}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-secondary)] truncate">{h.display_name}</p>
            {h.source && <p className="text-xs text-[var(--text-faint)] truncate">{h.source === "b2b_voucher" ? "Voucher" : "Manual override"}</p>}
            {h.expires_at && (
              <p className="text-xs text-[var(--text-faint)] truncate">
                {new Date(h.expires_at) < new Date() ? 'Expired ' : 'Expires '}
                {new Date(h.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            type="button" onClick={() => handleToggle(h.household_id, h.tier)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              h.tier === "paid"
                ? "bg-[var(--surface-alt)] text-[var(--success-text)]"
                : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
            }`}
          >
            {h.tier === "paid" ? "Paid — tap to set free" : "Free — tap to set paid"}
          </button>
        </div>
      ))}
    </div>
  )
}
