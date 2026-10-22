import { useEffect, useState } from 'react'
import { api } from '../api'
import Loading from '../components/Loading'

// Owner-only (server/routers/admin_users.py, require_owner). A plain
// admin's fetch 403s -- that's not an error to show, it just means
// this viewer isn't an owner, so the whole section quietly renders
// nothing rather than a dead-end error card. Added 2026-10-08 per the
// user's explicit requirement: a second real admin won't have access
// to the machine scripts/create_admin_user.py runs on, so managing
// admin accounts has to be possible from here.
export default function AdminUsersSection({ token, onSessionError }) {
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
