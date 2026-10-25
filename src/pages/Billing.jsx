import { useState } from 'react'
import { api } from '../api'
import AdminMetricChart from '../components/AdminMetricChart'
import { Bars, dayLabel } from '../components/Charts'
import Loading from '../components/Loading'
import {
  Card, ErrorNote, ExtLink, PageHeader, Segmented, StatTile, Table, fmtDate, fmtMoney, fmtNum, useAdminData, useSession,
} from '../components/ui'
import EntitlementsSection from '../sections/EntitlementsSection'
import HouseholdTiersSection from '../sections/HouseholdTiersSection'

// Premium, vouchers and money actually taken. Revenue today is B2B
// voucher packs; app-store subscriptions aren't built yet, so MRR is 0.
export default function Billing() {
  const [days, setDays] = useState(30)
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.billing(t, days), [days])
  const session = useSession()

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />
  const s = data.summary.error ? null : data.summary
  const stripe = data.stripe

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" subtitle="Premium, voucher packs and Stripe." updatedAt={updatedAt} loading={loading} onRefresh={reload}>
        <Segmented options={[[7, '7d'], [30, '30d'], [90, '90d']]} value={days} onChange={setDays} />
      </PageHeader>
      <ErrorNote>{error || data.summary.error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label={`Taken in ${days} days`} value={stripe?.configured && !stripe.error ? fmtMoney(stripe.revenue) : '—'}
          sub={stripe?.configured ? (stripe.error || `${stripe.charges} payments · ${stripe.failed} failed${stripe.live_mode ? '' : ' · test mode'}`) : 'Stripe not connected'}
          tone={stripe?.failed ? 'warn' : undefined}
        />
        <StatTile
          label="Stripe balance" value={stripe?.available ? fmtMoney(stripe.available.gbp ?? Object.values(stripe.available)[0] ?? 0) : '—'}
          sub={stripe?.pending ? `${fmtMoney(stripe.pending.gbp ?? Object.values(stripe.pending)[0] ?? 0)} pending` : null}
        />
        {s && <StatTile label="Premium households" value={fmtNum(s.premium.active)} sub={`of ${s.premium.households} · ${s.premium.expiring_30d} ending within 30 days`} tone={s.premium.expiring_30d ? 'warn' : undefined} />}
        {s && <StatTile label="Vouchers redeemed" value={fmtNum(s.vouchers.redeemed)} sub={`of ${s.vouchers.issued} issued · ${s.vouchers.unused} unused`} />}
        {s && <StatTile label="Vouchers sold" value={fmtNum(s.vouchers.sold)} sub={`${s.vouchers.sold_redeemed} redeemed`} />}
        {s && <StatTile label="Revoked vouchers" value={fmtNum(s.vouchers.revoked)} />}
        {s && <StatTile label="Premium lapsed" value={fmtNum(s.premium.expired)} />}
        {!data.mrr.error && <StatTile label="MRR" value={fmtMoney(data.mrr.current)} sub="Subscriptions come with app-store billing" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title={`Money taken (${days} days)`} action={<ExtLink href="https://dashboard.stripe.com/payments">Stripe</ExtLink>}>
          {stripe?.series ? (
            <Bars series={stripe.series.map((d) => ({ label: dayLabel(d.date), value: d.value }))} colors={['var(--chart-3)']} height={110} format={(v) => fmtMoney(v)} />
          ) : <p className="text-sm text-[var(--text-muted)]">{stripe?.error || 'Stripe isn’t connected on the server (STRIPE_API_KEY).'}</p>}
        </Card>
        {s && (
          <Card title="Voucher redemptions (30 days)">
            <Bars series={s.redemptions_trend.map((d) => ({ label: dayLabel(d.date), value: d.value }))} colors={['var(--chart-2)']} height={110} />
          </Card>
        )}
        {!data.mrr.error && days > 7 && (
          <AdminMetricChart title={`MRR (${days} days)`} color="var(--chart-1)" value={fmtMoney(data.mrr.current)} changePct={data.mrr.change_pct} series={data.mrr.series} />
        )}
      </div>

      {stripe?.recent && (
        <Card title="Latest payments">
          <Table
            rows={stripe.recent} empty="No payments in this period."
            columns={[
              { key: 'created', label: 'When', className: 'whitespace-nowrap', render: (r) => fmtDate(r.created, true) },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmtMoney(r.amount, r.currency) },
              { key: 'status', label: 'Status', render: (r) => (r.refunded ? 'refunded' : r.status) },
              { key: 'email', label: 'Customer', render: (r) => r.email || '—' },
              { key: 'description', label: 'For', render: (r) => r.description || '—' },
            ]}
          />
        </Card>
      )}

      {s && (
        <Card title="Voucher packs">
          <Table
            rows={s.recent_batches} empty="No voucher packs yet."
            columns={[
              { key: 'created_at', label: 'When', className: 'whitespace-nowrap', render: (r) => fmtDate(r.created_at) },
              { key: 'quantity', label: 'Codes', align: 'right' },
              { key: 'kind', label: 'Type', render: (r) => (r.kind === 'purchased' ? 'Bought' : 'Complimentary') },
              { key: 'partner', label: 'Business', render: (r) => r.partner || '—' },
              { key: 'buyer_email', label: 'Buyer', render: (r) => r.buyer_email || '—' },
            ]}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card><HouseholdTiersSection {...session} /></Card>
        <Card><EntitlementsSection {...session} /></Card>
      </div>
    </div>
  )
}
