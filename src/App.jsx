import { AdminProvider, useAdmin } from './context/AdminContext'
import Shell, { useRoute } from './components/Shell'
import ThemeToggle from './components/ThemeToggle'
import LoginForm from './pages/Login'
import Overview from './pages/Overview'
import Customers from './pages/Customers'
import Billing from './pages/Billing'
import Outreach from './pages/Outreach'
import AppHealth from './pages/AppHealth'
import Services from './pages/Services'
import Errors from './pages/Errors'
import SettingsPage from './pages/Settings'

// Standalone admin site, rebuilt as separate pages 2026-10-22. The real
// gate is server-side on every /api/admin/* route (require_admin); the
// login form here only stops a visitor seeing raw 401s.
const PAGE_COMPONENTS = {
  overview: Overview, customers: Customers, billing: Billing, outreach: Outreach, app: AppHealth,
  services: Services, errors: Errors, settings: SettingsPage,
}

function Routed() {
  const { isAuthenticated } = useAdmin()
  const route = useRoute()
  if (!isAuthenticated) {
    return (
      <>
        <div className="flex justify-end px-4 pt-4"><ThemeToggle /></div>
        <LoginForm />
      </>
    )
  }
  const Page = PAGE_COMPONENTS[route]
  return (
    <Shell route={route}>
      <Page key={route} />
    </Shell>
  )
}

export default function App() {
  return (
    <AdminProvider>
      <Routed />
    </AdminProvider>
  )
}
