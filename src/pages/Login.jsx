import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'

export default function LoginForm() {
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
