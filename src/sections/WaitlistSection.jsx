import { useEffect, useState } from 'react'
import { api } from '../api'
import Loading from '../components/Loading'

// Closed-beta/waitlist signups from duolign.co.uk (a separate static
// repo -- the marketing site's own client-side JS inserts directly into
// Supabase's beta_signups table with its public anon key, which can
// INSERT but never SELECT). Previously only checkable via a direct
// Supabase dashboard query -- this is read-only, no action to take here.
export default function WaitlistSection({ token, onSessionError }) {
  const [signups, setSignups] = useState(null)

  useEffect(() => {
    api.admin.waitlist(token).then((d) => setSignups(d.signups), onSessionError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (signups === null) return <Loading inline />

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">
        Waitlist{signups.length > 0 ? ` — ${signups.length}` : ''}
      </h2>
      {signups.length === 0 && <p className="text-xs text-[var(--text-faint)]">No waitlist signups yet.</p>}
      {signups.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-start justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-secondary)] truncate">{s.email}</p>
            {(s.partner_status || s.split_style || s.current_tools) && (
              <p className="text-xs text-[var(--text-faint)] truncate">
                {[s.partner_status, s.split_style, s.current_tools].filter(Boolean).join(' · ')}
              </p>
            )}
            {s.feedback_opt_in && (
              <p className="text-xs text-[var(--success-text)]">Open to a feedback chat</p>
            )}
            <p className="text-xs text-[var(--text-faint)]">
              {new Date(s.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className="shrink-0 text-xs text-[var(--text-faint)]">{s.source}</span>
        </div>
      ))}
    </div>
  )
}
