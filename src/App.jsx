import { AdminProvider } from './context/AdminContext'
import Admin from './pages/Admin'

// Standalone admin site -- no routing, no household app scaffolding
// (BrowserRouter, AuthProvider, DeviceLockGate, etc. from the consumer
// app's App.jsx). Admin.jsx itself already renders its own login form
// vs. dashboard based on AdminContext's token state, so this is the
// entire app shell.
export default function App() {
  return (
    <AdminProvider>
      <Admin />
    </AdminProvider>
  )
}
