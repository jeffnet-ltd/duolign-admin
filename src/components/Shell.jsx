import { useEffect, useState } from 'react'
import {
  Activity, AlertOctagon, CreditCard, LayoutDashboard, LogOut, Megaphone, Server, Settings, Users,
} from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { api } from '../api'
import { StatusDot } from './ui'
import ThemeToggle from './ThemeToggle'

export const PAGES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'outreach', label: 'Outreach', icon: Megaphone },
  { id: 'app', label: 'App health', icon: Activity },
  { id: 'services', label: 'Services', icon: Server },
  { id: 'errors', label: 'Errors', icon: AlertOctagon },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// Hash routing (#/billing): the site is static on GitHub Pages, so a
// path route would 404 on reload.
export function useRoute() {
  const read = () => {
    const id = window.location.hash.replace(/^#\/?/, '').split('/')[0]
    return PAGES.some((p) => p.id === id) ? id : 'overview'
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onHash = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

export const go = (id) => { window.location.hash = `/${id}` }

// The nav's own status light: polls the services summary so a problem
// shows on every page, not just Services. If the API itself can't be
// reached that's the loudest signal of all.
function useOverallStatus() {
  const { token, logout } = useAdmin()
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let alive = true
    const check = () => api.admin.services(token).then(
      (d) => alive && setStatus(d?.overall ?? null),
      // No status means the request never got an answer at all.
      (err) => { if (err.status === 401) logout(); else if (alive) setStatus(err.status ? null : 'unreachable') },
    )
    check()
    const id = setInterval(() => { if (document.visibilityState === 'visible') check() }, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [token, logout])
  return status
}

export default function Shell({ route, children }) {
  const { logout } = useAdmin()
  const overall = useOverallStatus()
  const unreachable = overall === 'unreachable'

  return (
    <div className="min-h-full md:flex">
      <nav className="md:w-56 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-[var(--surface-border)] bg-[var(--bg-solid)]/80 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2 px-4 pt-3 md:pt-5 md:pb-4">
          <a href="#/overview" className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <img src="/favicon.png" alt="" className="w-6 h-6 rounded-md" />
            Duolign admin
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button type="button" onClick={logout} className="md:hidden flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <LogOut size={13} strokeWidth={2} /> Sign out
            </button>
          </div>
        </div>
        <ul className="flex md:flex-col gap-0.5 overflow-x-auto px-2 py-2 md:px-3 md:py-0 [scrollbar-width:none]">
          {PAGES.map(({ id, label, icon: Icon }) => {
            const active = route === id
            return (
              <li key={id} className="shrink-0">
                <a
                  href={`#/${id}`} aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors ${
                    active ? 'bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {label}
                  {id === 'services' && overall && overall !== 'ok' && overall !== 'unconfigured' && (
                    <StatusDot status={unreachable ? 'down' : overall} pulse />
                  )}
                </a>
              </li>
            )
          })}
        </ul>
        <div className="hidden md:block absolute bottom-4 left-0 right-0 px-5">
          <button type="button" onClick={logout} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <LogOut size={13} strokeWidth={2} /> Sign out
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-7 max-w-6xl space-y-5">
        {unreachable && (
          <div role="alert" className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
            <strong>Can't reach the Duolign API.</strong> The backend on Railway may be down or redeploying. This page
            is hosted separately, so it keeps working, but nothing below can update until the API answers.
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
