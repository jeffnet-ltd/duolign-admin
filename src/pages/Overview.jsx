import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import AdminMetricChart from '../components/AdminMetricChart'
import { Bars, dayLabel, hourLabel } from '../components/Charts'
import Loading from '../components/Loading'
import { go } from '../components/Shell'
import {
  Card, ErrorNote, PageHeader, StatTile, StatusBadge, StatusDot, fmtMoney, fmtNum, statusStyle, timeAgo, useAdminData,
} from '../components/ui'

const AREA_PAGE = { services: 'services', customers: 'customers', billing: 'billing' }

// The one screen to open first: anything that needs attention, then the
// headline number and a chart from every other page.
export default function Overview() {
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.overview(t), [], { poll: 60_000 })

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />

  const a = data.audience.error ? null : data.audience
  const b = data.billing.error ? null : data.billing
  const stripe = data.stripe?.configured && !data.stripe.error ? data.stripe : null
  const allClear = data.attention.length === 0

  return (
    <div className="space-y-5">
      <PageHeader title="Overview" subtitle="Everything at a glance. Refreshes every minute." updatedAt={updatedAt} loading={loading} onRefresh={reload} />
      <ErrorNote>{error}</ErrorNote>

      {allClear ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--success-bg)] px-4 py-3">
          <CheckCircle2 size={20} className="text-[var(--success-text)] shrink-0" />
          <p className="text-sm text-[var(--text-primary)]">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <Card title={`Needs attention (${data.attention.length})`}>
          <ul className="space-y-2">
            {data.attention.map((item) => (
              <li key={`${item.area}-${item.title}`}>
                <button
                  type="button" onClick={() => go(AREA_PAGE[item.area] || 'services')}
                  className={`w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left ${statusStyle(item.tone).bg}`}
                >
                  <span className="pt-1"><StatusDot status={item.tone} pulse /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
                    <span className="block text-sm text-[var(--text-secondary)]">{item.text}</span>
                  </span>
                  <ArrowRight size={15} className="text-[var(--text-muted)] mt-1 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Services" action={<button type="button" onClick={() => go('services')} className="text-xs text-[var(--info-text)]">Details</button>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.services.map((s) => (
            <button
              key={s.key} type="button" onClick={() => go('services')} title={s.summary}
              className="flex items-center gap-2 rounded-lg bg-[var(--surface-alt)]/50 px-2.5 py-2 text-left min-w-0"
            >
              <StatusDot status={s.status} />
              <span className="text-xs text-[var(--text-secondary)] truncate">{s.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Households" value={fmtNum(a?.households.total)} sub={a ? `${a.households.new_7d} new this week` : null} onClick={() => go('customers')} />
        <StatTile label="Active this week" value={fmtNum(a?.households.active_7d)} sub={a ? `${a.households.active_30d} in 30 days` : null} onClick={() => go('customers')} />
        <StatTile label="Premium households" value={fmtNum(b?.premium.active)} sub={b ? `${b.vouchers.redeemed} vouchers redeemed` : null} onClick={() => go('billing')} />
        <StatTile
          label="Taken in 30 days" value={stripe ? fmtMoney(stripe.revenue) : '—'}
          sub={stripe ? `${stripe.charges} payment${stripe.charges === 1 ? '' : 's'}${stripe.live_mode ? '' : ' (test mode)'}` : 'Stripe not connected'}
          onClick={() => go('billing')}
        />
        <StatTile
          label="API requests (24h)" value={fmtNum(data.requests.requests_24h)}
          sub={`${data.requests.server_errors_24h} server errors · up ${timeAgo(data.requests.started_at).replace(' ago', '')}`}
          tone={data.requests.server_errors_24h ? 'warn' : undefined} onClick={() => go('app')}
        />
        <StatTile label="Signed up" value={fmtNum(a?.users.total)} sub={a ? `${a.users.new_7d} this week` : null} onClick={() => go('customers')} />
        <StatTile label="Waitlist" value={fmtNum(a?.waitlist)} sub={a ? `${a.marketing_opt_ins} opted in to news` : null} onClick={() => go('customers')} />
        <StatTile
          label="Overall status" value={<StatusBadge status={data.overall} />}
          sub={`${data.services.filter((s) => s.status === 'unconfigured').length} not connected`} onClick={() => go('services')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {!data.new_households?.error && (
          <AdminMetricChart
            title="New households (30 days)" color="#9333ea"
            value={fmtNum(data.new_households.current)} changePct={data.new_households.change_pct} series={data.new_households.series}
          />
        )}
        <Card title="API traffic (24 hours)">
          <Bars
            series={data.requests.series.map((h) => ({
              label: hourLabel(h.hour), short: hourLabel(h.hour),
              parts: { OK: h.requests - h.server_errors - h.client_errors, 'Client errors': h.client_errors, 'Server errors': h.server_errors },
            }))}
            stack={['OK', 'Client errors', 'Server errors']} colors={['#38bdf8', '#fbbf24', '#f87171']} height={100}
          />
        </Card>
        <Card title="Errors reported to Sentry (14 days)" action={<button type="button" onClick={() => go('errors')} className="text-xs text-[var(--info-text)]">Errors</button>}>
          {data.errors_per_day && !data.errors_per_day.error ? (
            <Bars series={data.errors_per_day.map((d) => ({ label: dayLabel(d.date), value: d.value }))} colors={['#f87171']} height={100} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Connect Sentry on the server (SENTRY_AUTH_TOKEN, SENTRY_ORG) to see this.</p>
          )}
        </Card>
        {stripe ? (
          <Card title="Money taken (30 days)">
            <Bars series={stripe.series.map((d) => ({ label: dayLabel(d.date), value: d.value }))} colors={['#34d399']} height={100} format={(v) => fmtMoney(v)} />
          </Card>
        ) : !data.uptime?.error && (
          <AdminMetricChart
            title="Worker uptime (30 days)" color="#34d399"
            value={data.uptime.current == null ? '—' : `${data.uptime.current}%`} changePct={data.uptime.change_pct} series={data.uptime.series}
          />
        )}
      </div>
    </div>
  )
}
