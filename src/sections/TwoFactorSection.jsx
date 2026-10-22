import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../api'
import Loading from '../components/Loading'

// Opt-in TOTP 2FA, 2026-10-17 -- self-service, any admin manages their
// own (server/routers/admin.py's /mfa/* routes, request.state.email,
// never another admin's). QR code rendered client-side from the
// otpauth:// provisioning_uri the backend returns -- no image
// generation on the server at all.
export default function TwoFactorSection({ token, onSessionError }) {
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
