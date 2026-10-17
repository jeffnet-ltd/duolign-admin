import { createContext, useCallback, useContext, useState } from 'react'
import { api } from '../api'

// The admin session token -- a SEPARATE credential from the rest of
// this app (server/admin_auth_service.py's own email+password store,
// never the household Supabase session). sessionStorage, not
// localStorage: cleared when the tab/browser closes, limiting how long
// a leaked token stays usable, while still surviving a page reload
// within the same session.
const STORAGE_KEY = 'duolign_admin_token'

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY)
    } catch {
      return null // private-window/blocked storage -- just means no remembered session
    }
  })
  // 2026-10-17: opt-in TOTP 2FA -- a successful password check on an
  // enrolled admin returns {mfa_required, pending_token} instead of a
  // real token (server/routers/admin_auth.py's /login). Held here, not
  // sessionStorage -- it's short-lived (5 min) and only ever needed for
  // the one verifyTotp() call that completes login, never persisted
  // across a reload.
  const [mfaPendingToken, setMfaPendingToken] = useState(null)

  function _storeToken(newToken) {
    try {
      sessionStorage.setItem(STORAGE_KEY, newToken)
    } catch {
      // Storage blocked -- the session still works for this render, it
      // just won't survive a reload. Not worth failing login over.
    }
    setToken(newToken)
  }

  const login = useCallback(async (email, password) => {
    const result = await api.admin.login(email, password)
    if (result.mfa_required) {
      setMfaPendingToken(result.pending_token)
      return { mfaRequired: true }
    }
    _storeToken(result.token)
    return { mfaRequired: false }
  }, [])

  const verifyTotp = useCallback(async (code) => {
    const { token: newToken } = await api.admin.verifyTotp(mfaPendingToken, code)
    setMfaPendingToken(null)
    _storeToken(newToken)
  }, [mfaPendingToken])

  const cancelMfa = useCallback(() => {
    setMfaPendingToken(null)
  }, [])

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clean up if storage was never reachable.
    }
    setToken(null)
    setMfaPendingToken(null)
  }, [])

  return (
    <AdminContext.Provider value={{
      token, isAuthenticated: !!token, login, logout,
      mfaPending: !!mfaPendingToken, verifyTotp, cancelMfa,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider')
  return ctx
}
