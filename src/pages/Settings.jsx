import { Card, PageHeader, useSession } from '../components/ui'
import AdminUsersSection from '../sections/AdminUsersSection'
import TwoFactorSection from '../sections/TwoFactorSection'

// Your own sign-in security, and (owners only) who else has admin access.
export default function SettingsPage() {
  const session = useSession()
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Your sign-in, and who can use this dashboard." />
      <div className="max-w-2xl space-y-3">
        <TwoFactorSection {...session} />
        <Card><AdminUsersSection {...session} /></Card>
      </div>
    </div>
  )
}
