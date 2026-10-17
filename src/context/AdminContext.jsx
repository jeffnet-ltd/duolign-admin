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

  const login = useCallback(async (email, password) => {
    const { token: newToken } = await api.admin.login(email, password)
    try {
      sessionStorage.setItem(STORAGE_KEY, newToken)
    } catch {
      // Storage blocked -- the session still works for this render, it
      // just won't survive a reload. Not worth failing login over.
    }
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clean up if storage was never reachable.
    }
    setToken(null)
  }, [])

  return (
    <AdminContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider')
  return ctx
}
