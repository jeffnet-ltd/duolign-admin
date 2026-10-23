import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

// Light/dark choice, the same way the app and duolign.co.uk do it: follow
// the device until a pick, then remember the pick. index.html applies a
// stored pick before the first paint.
const KEY = 'duolign-admin-theme'
const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true

function current() {
  const set = document.documentElement.getAttribute('data-theme')
  return set === 'light' || set === 'dark' ? set : (prefersDark() ? 'dark' : 'light')
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(current)

  // While following the device, keep the icon right if the device switches.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return undefined
    const onChange = () => setTheme(current())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(KEY, next) } catch { /* private window: this visit only */ }
    setTheme(next)
  }

  // The icon shows the theme a tap switches to.
  const dark = theme === 'dark'
  return (
    <button
      type="button" onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${className}`}
    >
      {dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
    </button>
  )
}
