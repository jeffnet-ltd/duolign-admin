import { useState } from 'react'
import { api } from '../api'
import AdminMetricChart from '../components/AdminMetricChart'
import { HBars } from '../components/Charts'
import Loading from '../components/Loading'
import {
  Card, ErrorNote, PageHeader, Segmented, StatTile, Table, fmtDate, fmtNum, timeAgo, useAdminData, useSession,
} from '../components/ui'
import DeletionRequestsSection from '../sections/DeletionRequestsSection'
import WaitlistSection from '../sections/WaitlistSection'

// Who's signed up, how far they've got, and who's still using it.
export default function Customers() {
  const [days, setDays] = useState(30)
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.audience(t, days), [days])
  const session = useSession()

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />
  const s = data.summary.error ? null : data.summary

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Real households only; test data is left out." updatedAt={updatedAt} loading={loading} onRefresh={reload}>
        <Segmented options={[[7, '7d'], [30, '30d'], [90, '90d']]} value={days} onChange={setDays} />
      </PageHeader>
      <ErrorNote>{error || data.summary.error}</ErrorNote>

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="People signed up" value={fmtNum(s.users.total)} sub={`${s.users.new_7d} this week · ${s.users.new_30d} in 30 days`} />
          <StatTile label="Households" value={fmtNum(s.households.total)} sub={`${s.households.with_partner} with a partner · ${s.households.solo} solo`} />
          <StatTile label="Active households" value={fmtNum(s.households.active_7d)} sub={`this week · ${s.households.active_30d} in 30 days`} />
          <StatTile label="Signed in this week" value={fmtNum(s.users.signed_in_7d)} sub={`${s.users.signed_in_30d} in 30 days`} />
          <StatTile label="Partner invites waiting" value={fmtNum(s.invites.pending)} sub={`${s.invites.accepted} accepted so far`} />
          <StatTile label="Waitlist" value={fmtNum(s.waitlist)} />
          <StatTile label="Opted in to news" value={fmtNum(s.marketing_opt_ins)} />
          <StatTile label="Deletion requests" value={fmtNum(s.pending_deletion_requests)} tone={s.pending_deletion_requests ? 'warn' : undefined} sub="waiting" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {s && (
          <Card title="How far people get" className="self-start">
            <HBars items={s.funnel.map((f) => ({ label: f.step, value: f.count }))} format={fmtNum} />
            <p className="text-xs text-[var(--text-faint)]">
              Active means something in the household was saved (categorising, closing a month, running payday), not just opening the app.
            </p>
          </Card>
        )}
        <div className="grid gap-3">
          {!data.new_users.error && (
            <AdminMetricChart
              title={`New sign-ups (${days} days)`} color="var(--chart-1)"
              value={fmtNum(data.new_users.reduce((t, p) => t + p.value, 0))} series={data.new_users}
            />
          )}
          {!data.new_households.error && (
            <AdminMetricChart
              title={`New households (${days} days)`} color="var(--chart-2)"
              value={fmtNum(data.new_households.current)} changePct={data.new_households.change_pct} series={data.new_households.series}
            />
          )}
          {!data.churn.error && (
            <AdminMetricChart
              title={`Households deleted (${days} days)`} color="var(--danger)"
              value={fmtNum(data.churn.current)} changePct={data.churn.change_pct} series={data.churn.series}
            />
          )}
        </div>
      </div>

      <Card title={`Households${Array.isArray(data.households) ? ` (${data.households.length})` : ''}`}>
        {data.households.error ? <ErrorNote>{data.households.error}</ErrorNote> : (
          <Table
            rowKey={(r) => r.household_id} rows={data.households} empty="No real households yet."
            columns={[
              { key: 'display_name', label: 'Household', className: 'font-medium text-[var(--text-primary)]' },
              { key: 'created_at', label: 'Joined', className: 'whitespace-nowrap', render: (r) => fmtDate(r.created_at) },
              { key: 'last_active', label: 'Last active', className: 'whitespace-nowrap', render: (r) => timeAgo(r.last_active) },
              { key: 'members', label: 'People', align: 'right', render: (r) => (r.mode === 'solo' ? 'solo' : r.members) },
              { key: 'progress', label: 'Progress', render: (r) => (r.ran_a_payday ? 'Ran a payday' : r.closed_a_month ? 'Closed a month' : 'Setting up') },
              { key: 'tier', label: 'Plan', render: (r) => (r.tier === 'paid' ? <span className="text-[var(--success-text)]">Premium</span> : 'Free') },
            ]}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card><DeletionRequestsSection {...session} /></Card>
        <Card><WaitlistSection {...session} /></Card>
      </div>
    </div>
  )
}
