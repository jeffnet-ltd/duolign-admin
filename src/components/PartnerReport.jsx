import { BarChart3 } from 'lucide-react'

// Voucher programme stage 6 (Couple_finance_app docs/VOUCHER_PROGRAMME_PLAN.md):
// how each partner business and each category is doing. Built server-side by
// partner_service.programme_report(). "Active after 30 days" only counts
// households that redeemed at least 30 days ago, and only things a person
// does in the app (closing a payday, categorising, entering balances,
// editing bills, debts or pots) -- never the background sync.

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')

function Figures({ r }) {
  return [
    ['Sent', r.vouchers_sent],
    ['Redeemed', `${r.redeemed} (${pct(r.redeemed, r.vouchers_sent)})`],
    ['Median days to redeem', r.median_days_to_redeem ?? '—'],
    ['Active after 30 days', r.retention_eligible ? `${r.active_after_30_days} of ${r.retention_eligible}` : '—'],
    ['Subscribed to Premium', r.subscribed_after],
    ['Packs bought', r.packs_bought ? `${r.packs_bought} (${r.packs_first} first · ${r.packs_repeat} repeat · ${r.packs_discounted} at 20% off)` : 0],
  ]
}

function Grid({ rows }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-[var(--text-faint)]">{label}</dt>
          <dd className="text-xs font-medium text-[var(--text-primary)] break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Group({ title, items, name }) {
  if (!items.length) return null
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">{title} ({items.length})</summary>
      <div className="mt-2 divide-y divide-[var(--surface-border)]">
        {items.map((r) => (
          <div key={r.partner_id || r.category} className="py-2 space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-primary)]">{name(r)}</p>
            <Grid rows={Figures({ r })} />
          </div>
        ))}
      </div>
    </details>
  )
}

export default function PartnerReport({ report, categories }) {
  if (!report) return null
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <BarChart3 size={13} strokeWidth={2} /> How the programme is doing
      </h3>
      <Grid rows={[['Partner businesses', report.totals.partners], ...Figures({ r: report.totals })]} />
      <Group
        title="By category" items={report.by_category}
        name={(r) => `${r.category_label} · ${r.partners} ${r.partners === 1 ? 'business' : 'businesses'}`}
      />
      <Group
        title="By business" items={report.by_partner}
        name={(r) => `${r.business_name} · ${categories?.[r.category] ?? r.category}`}
      />
    </div>
  )
}
