import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { LogOut, Server, Users } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { api } from '../api'
import AdminMetricChart from '../components/AdminMetricChart'
import Loading from '../components/Loading'
import StatusDot from '../components/StatusDot'

// Admin-only cross-household dashboard (docs/ROADMAP.md's "Observability
// & admin dashboard"). The REAL gate is server-side on every /api/admin/*
// route (server/auth.py's require_admin, checking server/admin_auth_
// service.py's own email+password session -- a SEPARATE credential from
// the rest of this app, per the user's explicit requirement 2026-10-08).
// This page's login form is cosmetic, not the boundary -- it just means
// a visitor with no valid session sees a form instead of raw 401s.
export default function Admin() {
  const { isAuthenticated } = useAdmin()
  return isAuthenticated ? <Dashboard /> : <LoginForm />
}

function LoginForm() {
  const { login, mfaPending, verifyTotp, cancelMfa } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyTotp(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await verifyTotp(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 2026-10-17: opt-in TOTP 2FA -- login() above already proved the
  // password was correct for an enrolled admin, this is just the
  // second step to actually get a session (AdminContext.verifyTotp).
  if (mfaPending) {
    return (
      <div className="px-4 py-10 max-w-sm mx-auto">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Enter your code</h1>
        <p className="text-xs text-[var(--text-faint)] mb-4">From your authenticator app.</p>
        <form onSubmit={handleVerifyTotp} className="space-y-3">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
            placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] tracking-widest"
          />
          {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
          <button
            type="submit" disabled={submitting}
            className="w-full rounded-lg gradient-accent text-white text-sm font-medium py-2.5 disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button" onClick={cancelMfa}
            className="w-full text-xs text-[var(--text-faint)]"
          >
            Back
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="px-4 py-10 max-w-sm mx-auto">
      <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Admin login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email" required autoComplete="username" placeholder="you@duolign.co.uk"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
        />
        <input
          type="password" required autoComplete="current-password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
        />
        {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
        <button
          type="submit" disabled={submitting}
          className="w-full rounded-lg gradient-accent text-white text-sm font-medium py-2.5 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function Dashboard() {
  const { token, logout } = useAdmin()
  const [count, setCount] = useState(null)
  const [signups, setSignups] = useState(null)
  const [households, setHouseholds] = useState(null)
  const [runpod, setRunpod] = useState(null)

  // A 401 (invalid/expired token) drops back to the login form; any
  // OTHER failure (a transient 500, say) just leaves that one section
  // stuck loading rather than signing someone out over something that
  // had nothing to do with their session.
  function onSessionError(err) {
    if (err.status === 401) logout()
  }

  useEffect(() => {
    api.admin.householdCount(token).then((d) => setCount(d.count), onSessionError)
    api.admin.signups(token).then((d) => setSignups(d.households), onSessionError)
    api.admin.syncHealth(token).then((d) => setHouseholds(d.households), onSessionError)
    api.admin.runpodHealth(token).then(setRunpod, onSessionError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (count === null || signups === null || households === null || runpod === null) return <Loading />

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Admin</h1>
        <button
          type="button" onClick={logout}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
        >
          <LogOut size={13} strokeWidth={2} /> Sign out
        </button>
      </div>

      <TwoFactorSection token={token} onSessionError={onSessionError} />

      <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 flex items-center gap-3">
        <Users size={20} strokeWidth={1.5} className="text-[var(--text-muted)]" />
        <div>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{count}</p>
          <p className="text-xs text-[var(--text-faint)]">Real households (onboarded, excluding test/dev data)</p>
        </div>
      </div>

      <MetricsSection token={token} onSessionError={onSessionError} />

      <div className="space-y-2">
        <h2 className="text-xs font-medium text-[var(--text-muted)]">Recent signups</h2>
        {signups.length === 0 && <p className="text-xs text-[var(--text-faint)]">No real households yet.</p>}
        {signups.map((s) => (
          <div
            key={s.household_id}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm text-[var(--text-secondary)] min-w-0 truncate">{s.display_name}</span>
            <span className="text-xs text-[var(--text-faint)] shrink-0 tabular-nums">
              {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-medium text-[var(--text-muted)]">Sync health, every household</h2>
        {households.length === 0 && <p className="text-xs text-[var(--text-faint)]">No real households yet.</p>}
        {households.map((h) => (
          <div
            key={h.household_id}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm text-[var(--text-secondary)] min-w-0 truncate">{h.display_name}</span>
            <span className={`inline-flex items-center gap-1.5 shrink-0 text-xs ${h.any_stale ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'}`}>
              <StatusDot tone={h.any_stale ? 'error' : 'ok'} />
              {h.error ? h.error : h.any_stale ? 'stale' : 'healthy'}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-medium text-[var(--text-muted)]">LLM extraction infra (RunPod)</h2>
        {!runpod.configured && <p className="text-xs text-[var(--text-faint)]">Not configured.</p>}
        {runpod.configured && !runpod.reachable && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 flex items-center gap-2">
            <StatusDot tone="error" />
            <span className="text-xs text-[var(--danger-text)]">Unreachable — {runpod.error}</span>
          </div>
        )}
        {runpod.configured && runpod.reachable && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <StatusDot tone={runpod.concerning ? 'error' : 'ok'} />
              <span className={`text-xs font-medium ${runpod.concerning ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'}`}>
                {runpod.concerning ? 'Needs attention' : 'Healthy'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
              <Server size={13} strokeWidth={2} />
              Workers — idle {runpod.workers.idle ?? 0}, ready {runpod.workers.ready ?? 0}, running {runpod.workers.running ?? 0},
              throttled {runpod.workers.throttled ?? 0}, unhealthy {runpod.workers.unhealthy ?? 0}
            </div>
            <div className="text-xs text-[var(--text-faint)]">
              Jobs — completed {runpod.jobs.completed ?? 0}, failed {runpod.jobs.failed ?? 0}, in queue {runpod.jobs.inQueue ?? 0}
            </div>
          </div>
        )}
      </div>

      <HouseholdTiersSection token={token} onSessionError={onSessionError} />
      <WaitlistSection token={token} onSessionError={onSessionError} />
      <DeletionRequestsSection token={token} onSessionError={onSessionError} />
      <EntitlementsSection token={token} onSessionError={onSessionError} />
      <AdminUsersSection token={token} onSessionError={onSessionError} />
      <LogsSection token={token} />
    </div>
  )
}

// Stripe-dashboard-style charts (docs/ROADMAP.md's "Observability &
// admin dashboard" section) -- uptime, MRR, user acquisition, churn.
// Pre-launch, every one of these is either genuinely empty (MRR -- no
// recurring revenue model exists yet) or just not accumulated any real
// history yet (uptime, signups, churn) -- see server/
// admin_metrics_service.py's own docstring for exactly what's real vs
// not. AdminMetricChart renders the "no data yet" state itself, at the
// same size a real chart would be, so this section's layout doesn't
// jump once real numbers start arriving.
const _RANGE_OPTIONS = [7, 30, 90]

// Opt-in TOTP 2FA, 2026-10-17 -- self-service, any admin manages their
// own (server/routers/admin.py's /mfa/* routes, request.state.email,
// never another admin's). QR code rendered client-side from the
// otpauth:// provisioning_uri the backend returns -- no image
// generation on the server at all.
function TwoFactorSection({ token, onSessionError }) {
  const [enabled, setEnabled] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [secret, setSecret] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  function refetch() {
    api.admin.mfaStatus(token).then((d) => setEnabled(d.enabled), onSessionError)
  }
  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (enabled === null) return <Loading inline />

  async function startEnroll() {
    setError(null)
    setBusy(true)
    try {
      const d = await api.admin.mfaEnroll(token)
      setSecret(d.secret)
      setQrDataUrl(await QRCode.toDataURL(d.provisioning_uri))
      setEnrolling(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function cancelEnroll() {
    setEnrolling(false); setSecret(null); setQrDataUrl(null); setConfirmCode(''); setError(null)
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.admin.mfaConfirm(token, confirmCode)
      cancelEnroll()
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.admin.mfaDisable(token, disablePassword)
      setDisabling(false); setDisablePassword('')
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Two-factor authentication</h2>
        <span className={`text-xs font-medium ${enabled ? 'text-[var(--success-text)]' : 'text-[var(--text-faint)]'}`}>
          {enabled ? 'Enabled' : 'Not enabled'}
        </span>
      </div>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}

      {!enabled && !enrolling && (
        <button
          type="button" onClick={startEnroll} disabled={busy}
          className="rounded-lg gradient-accent text-white text-xs font-medium px-3 py-2 disabled:opacity-50"
        >
          Set up 2FA
        </button>
      )}

      {enrolling && (
        <form onSubmit={handleConfirm} className="space-y-3">
          <p className="text-xs text-[var(--text-faint)]">
            Scan this with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrDataUrl && <img src={qrDataUrl} alt="2FA setup QR code" width={180} height={180} className="rounded-lg" />}
          <p className="text-xs text-[var(--text-faint)] break-all">
            Can't scan? Enter this key manually: <span className="font-mono text-[var(--text-secondary)]">{secret}</span>
          </p>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
            placeholder="123456" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)}
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-primary)] tracking-widest"
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={busy}
              className="flex-1 rounded-lg gradient-accent text-white text-xs font-medium py-2 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button" onClick={cancelEnroll}
              className="flex-1 rounded-lg bg-[var(--surface-alt)] text-[var(--text-secondary)] text-xs font-medium py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {enabled && !disabling && (
        <button
          type="button" onClick={() => setDisabling(true)}
          className="rounded-lg bg-[var(--surface-alt)] text-[var(--danger-text)] text-xs font-medium px-3 py-2"
        >
          Disable 2FA
        </button>
      )}
      {disabling && (
        <form onSubmit={handleDisable} className="flex gap-2">
          <input
            type="password" required autoComplete="current-password" placeholder="Confirm your password"
            value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          />
          <button
            type="submit" disabled={busy}
            className="rounded-lg bg-[var(--surface-alt)] text-[var(--danger-text)] text-xs font-medium px-3 disabled:opacity-50"
          >
            Disable
          </button>
          <button
            type="button" onClick={() => { setDisabling(false); setDisablePassword('') }}
            className="rounded-lg bg-[var(--surface-alt)] text-[var(--text-secondary)] text-xs font-medium px-3"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}

function MetricsSection({ token, onSessionError }) {
  const [days, setDays] = useState(30)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    api.admin.metrics(token, days).then(setMetrics, onSessionError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-[var(--text-muted)]">Metrics</h2>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-alt)] p-0.5">
          {_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt} type="button" onClick={() => setDays(opt)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                days === opt ? 'bg-[var(--surface)] text-[var(--text-primary)]' : 'text-[var(--text-faint)]'
              }`}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      {metrics === null ? (
        <Loading inline />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminMetricChart
            title="Uptime" color="#34d399"
            value={metrics.uptime.current == null ? '—' : `${metrics.uptime.current}%`}
            changePct={metrics.uptime.change_pct}
            series={metrics.uptime.series}
          />
          <AdminMetricChart
            title="MRR" color="#38bdf8"
            value={`£${metrics.mrr.current.toLocaleString('en-GB')}`}
            changePct={metrics.mrr.change_pct}
            series={metrics.mrr.series}
          />
          <AdminMetricChart
            title="New households" color="#9333ea"
            value={metrics.signups.current.toLocaleString('en-GB')}
            changePct={metrics.signups.change_pct}
            series={metrics.signups.series}
          />
          <AdminMetricChart
            title="Churn" color="#f87171"
            value={metrics.churn.current.toLocaleString('en-GB')}
            changePct={metrics.churn.change_pct}
            series={metrics.churn.series}
          />
        </div>
      )}
    </div>
  )
}

// Freemium tier (migration 0017, 2026-10-09) -- EVERY household, not
// just B2B-voucher ones (see EntitlementsSection below for those).
// This is how a household with no voucher at all gets marked 'paid'
// for testing, and how an admin can flip any household between tiers
// live to see both experiences -- the whole reason this exists.
function HouseholdTiersSection({ token, onSessionError }) {
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

// Closed-beta/waitlist signups from duolign.co.uk (a separate static
// repo -- the marketing site's own client-side JS inserts directly into
// Supabase's beta_signups table with its public anon key, which can
// INSERT but never SELECT). Previously only checkable via a direct
// Supabase dashboard query -- this is read-only, no action to take here.
function WaitlistSection({ token, onSessionError }) {
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

// Deletion requests filed from duolign.co.uk without the app (App Store
// review's web-reachable deletion path -- see
// db/migrations/0019_deletion_requests.sql and deletion_request_
// service.py). Not self-service: resolving one here only clears it off
// the queue -- the actual deletion still happens through the normal
// account/household admin tooling, after verifying who's asking.
function DeletionRequestsSection({ token, onSessionError }) {
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

// B2B billing (server/billing_service.py) -- every household that's
// redeemed a voucher. Visible to any admin (not owner-gated, unlike
// admin-account management below): this is ordinary dashboard data,
// not a privilege-escalation surface.
function EntitlementsSection({ token, onSessionError }) {
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

// Owner-only (server/routers/admin_users.py, require_owner). A plain
// admin's fetch 403s -- that's not an error to show, it just means
// this viewer isn't an owner, so the whole section quietly renders
// nothing rather than a dead-end error card. Added 2026-10-08 per the
// user's explicit requirement: a second real admin won't have access
// to the machine scripts/create_admin_user.py runs on, so managing
// admin accounts has to be possible from here.
function AdminUsersSection({ token, onSessionError }) {
  const [users, setUsers] = useState(null)
  const [isOwner, setIsOwner] = useState(true)
  const [error, setError] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('admin')
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')

  function refetch() {
    api.admin.listUsers(token).then(
      (d) => { setUsers(d.users); setIsOwner(true) },
      (err) => {
        if (err.status === 403) { setIsOwner(false); return }
        onSessionError(err)
      },
    )
  }

  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOwner) return null
  if (users === null) return <Loading inline />

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.admin.createUser(token, newEmail.trim(), newPassword, newRole)
      setNewEmail(''); setNewPassword(''); setNewRole('admin')
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(email) {
    if (!window.confirm(`Remove admin access for ${email}?`)) return
    setError(null)
    try {
      await api.admin.deleteUser(token, email)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.admin.resetPassword(token, resetTarget, resetPassword)
      setResetTarget(null); setResetPassword('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-[var(--surface-border-subtle)]">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">Admin accounts</h2>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
      {users.map((u) => (
        <div key={u.email} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-[var(--text-secondary)] min-w-0 truncate">{u.email}</span>
            <span className="text-xs uppercase tracking-wide text-[var(--text-faint)] shrink-0">{u.role}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button" onClick={() => setResetTarget(resetTarget === u.email ? null : u.email)}
              className="flex-1 rounded-lg bg-[var(--surface-alt)] text-[var(--text-primary)] text-xs font-medium py-1.5"
            >
              Reset password
            </button>
            <button
              type="button" onClick={() => handleDelete(u.email)}
              className="flex-1 rounded-lg bg-[var(--surface-alt)] text-[var(--danger-text)] text-xs font-medium py-1.5"
            >
              Remove
            </button>
          </div>
          {resetTarget === u.email && (
            <form onSubmit={handleResetSubmit} className="flex gap-2">
              <input
                type="password" required autoComplete="new-password" placeholder="New password" minLength={12}
                value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
              />
              <button type="submit" className="rounded-lg gradient-accent text-white text-xs font-medium px-3">Save</button>
            </form>
          )}
        </div>
      ))}

      <form onSubmit={handleAdd} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
        <h3 className="text-xs font-medium text-[var(--text-muted)]">Add an admin</h3>
        <input
          type="email" required autoComplete="off" placeholder="name@duolign.co.uk"
          value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
        />
        <input
          type="password" required autoComplete="new-password" placeholder="Initial password" minLength={12}
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
        />
        <select
          value={newRole} onChange={(e) => setNewRole(e.target.value)}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
        >
          <option value="admin">Admin — every dashboard view, can't manage admin accounts</option>
          <option value="owner">Owner — can also add/reset/remove admin accounts</option>
        </select>
        <button type="submit" className="w-full rounded-lg gradient-accent text-white text-xs font-medium py-2">
          Add admin
        </button>
      </form>
    </div>
  )
}

// Moved from DevZoneSection.jsx 2026-10-11 -- a tail of the live
// production log, used to be reachable by any logged-in household
// member; no household plausibly needs raw backend logs, so this is
// properly admin-gated now instead.
function LogsSection({ token }) {
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
