import { useEffect, useState } from 'react'
import { Check, Copy, Handshake } from 'lucide-react'
import { api } from '../api'
import Loading from './Loading'

// B2B voucher partnership programme, stage 2 (Couple_finance_app
// docs/VOUCHER_PROGRAMME_PLAN.md). Duolign enrols each partner business
// here -- enrolment issues its 3 complimentary vouchers (3 months of
// Premium each, redeemable for a year). The 90/180-day deadlines only
// gate the first-pack discount (stage 5); extending them never touches
// the vouchers. Every write goes through require_admin and is audit-logged
// server-side.

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const toInput = (iso) => (iso ? iso.slice(0, 10) : '')

const INPUT = 'w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]'
const BTN = 'rounded-lg bg-[var(--surface-alt)] text-[var(--text-primary)] text-xs font-medium px-3 py-1.5 disabled:opacity-50'
const PRIMARY = 'rounded-lg gradient-accent text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50'

const STATE_STYLE = {
  unused: 'text-[var(--text-secondary)]',
  redeemed: 'text-[var(--success-text)]',
  revoked: 'text-[var(--danger-text)]',
  expired: 'text-[var(--text-faint)]',
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button" aria-label={`Copy ${text}`}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      className="shrink-0 p-1 text-[var(--text-faint)]"
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
    </button>
  )
}

function EnrolmentWindow({ token, settings, onSaved, onSessionError }) {
  const [editing, setEditing] = useState(false)
  const [opens, setOpens] = useState(toInput(settings.enrolment_opens_on))
  const [closes, setCloses] = useState(toInput(settings.enrolment_closes_on))
  const [error, setError] = useState(null)

  async function save(body) {
    setError(null)
    try {
      await api.admin.setEnrolmentWindow(token, body)
      setEditing(false)
      onSaved()
    } catch (err) {
      onSessionError(err)
      setError(err.message)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-medium ${settings.enrolment_open ? 'text-[var(--success-text)]' : 'text-[var(--warn-text)]'}`}>
            {settings.enrolment_open ? 'Enrolment open' : 'Enrolment closed'}
          </p>
          <p className="text-xs text-[var(--text-faint)]">{settings.enrolment_note}</p>
        </div>
        <button type="button" onClick={() => setEditing((e) => !e)} className={`${BTN} shrink-0`}>
          {editing ? 'Cancel' : 'Set window'}
        </button>
      </div>
      {editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[var(--text-faint)] space-y-1">
              <span>Opens</span>
              <input type="date" value={opens} onChange={(e) => setOpens(e.target.value)} className={INPUT} />
            </label>
            <label className="text-xs text-[var(--text-faint)] space-y-1">
              <span>Closes</span>
              <input type="date" value={closes} onChange={(e) => setCloses(e.target.value)} className={INPUT} />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button" className={PRIMARY}
              onClick={() => save({ enrolment_opens_on: opens || null, enrolment_closes_on: closes || null })}
            >
              Save window
            </button>
            <button type="button" className={BTN} onClick={() => save({ enrolment_opens_on: null, enrolment_closes_on: null })}>
              Clear (pre-launch)
            </button>
          </div>
          <p className="text-xs text-[var(--text-faint)]">3 months from launch, extendable to 6. Both days are included.</p>
        </div>
      )}
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
    </div>
  )
}

const EMPTY_FORM = { business_name: '', category: '', email: '', contact_name: '', postcode: '', notes: '' }

function EnrolForm({ token, categories, disabled, onEnrolled, onSessionError }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [enrolled, setEnrolled] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await api.admin.enrolPartner(token, form)
      setEnrolled({ name: form.business_name, codes: result.codes })
      setForm(EMPTY_FORM)
      setOpen(false)
      onEnrolled()
    } catch (err) {
      onSessionError(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {enrolled && (
        <div className="rounded-lg border border-[var(--success-text)]/40 bg-[var(--success-bg)] p-3 space-y-1.5">
          <p className="text-xs font-medium text-[var(--success-text)]">
            {enrolled.name} is enrolled. Their 3 complimentary vouchers:
          </p>
          {enrolled.codes.map((c) => (
            <div key={c} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-[var(--text-primary)]">{c}</span>
              <CopyButton text={c} />
            </div>
          ))}
          <p className="text-xs text-[var(--text-faint)]">
            The business sends them to clients from its partner page on duolign.co.uk.
          </p>
          <button type="button" onClick={() => setEnrolled(null)} className="text-xs text-[var(--text-muted)] underline">Dismiss</button>
        </div>
      )}

      {!open ? (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={`${PRIMARY} w-full py-2`}>
          Enrol a business
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
          <h3 className="text-xs font-medium text-[var(--text-muted)]">Enrol a business</h3>
          <input required placeholder="Business name" value={form.business_name} onChange={set('business_name')} className={INPUT} />
          <select required value={form.category} onChange={set('category')} className={INPUT}>
            <option value="">Category…</option>
            {Object.entries(categories).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
          <input required type="email" autoComplete="off" placeholder="Business email (they sign in with this)" value={form.email} onChange={set('email')} className={INPUT} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Contact name" value={form.contact_name} onChange={set('contact_name')} className={INPUT} />
            <input placeholder="Postcode" value={form.postcode} onChange={set('postcode')} className={INPUT} />
          </div>
          <textarea rows={2} placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} className={INPUT} />
          <p className="text-xs text-[var(--text-faint)]">
            Issues 3 complimentary vouchers: 3 months of Premium each, redeemable for a year.
          </p>
          {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={PRIMARY}>{saving ? 'Enrolling…' : 'Enrol and issue vouchers'}</button>
            <button type="button" onClick={() => { setOpen(false); setError(null) }} className={BTN}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

function PartnerCard({ token, partner, onChanged, onSessionError }) {
  const [editing, setEditing] = useState(false)
  const [dist, setDist] = useState(toInput(partner.distribution_deadline))
  const [disc, setDisc] = useState(toInput(partner.discount_deadline))
  const [error, setError] = useState(null)

  async function run(fn) {
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (err) {
      onSessionError(err)
      setError(err.message)
    }
  }

  const saveDeadlines = () => run(async () => {
    await api.admin.updatePartner(token, partner.id, { distribution_deadline: dist || null, discount_deadline: disc || null })
    setEditing(false)
  })
  const setStatus = (status) => run(() => api.admin.updatePartner(token, partner.id, { status }))
  const revoke = (code) => {
    if (!window.confirm(`Revoke ${code}? It can never be redeemed after this.`)) return
    run(() => api.admin.revokeVoucher(token, code))
  }

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{partner.business_name}</p>
          <p className="text-xs text-[var(--text-faint)] truncate">{partner.category_label}</p>
          <p className="text-xs text-[var(--text-faint)] truncate">
            {partner.email}{partner.contact_name ? ` · ${partner.contact_name}` : ''}{partner.postcode ? ` · ${partner.postcode}` : ''}
          </p>
        </div>
        <select
          aria-label="Status" value={partner.status} onChange={(e) => setStatus(e.target.value)}
          className="shrink-0 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
        >
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      <div className="text-xs text-[var(--text-muted)] space-y-0.5">
        <p>
          Enrolled {fmtDate(partner.enrolled_at)} · Complimentary sent {partner.complimentary_sent}/{partner.complimentary_total}, redeemed {partner.complimentary_redeemed}
        </p>
        <p>
          Send all 3 by {fmtDate(partner.distribution_deadline)} · Discount usable until {fmtDate(partner.discount_deadline)}
          {' '}
          <button type="button" onClick={() => setEditing((e) => !e)} className="text-[var(--info-text)] underline">
            {editing ? 'cancel' : 'extend'}
          </button>
        </p>
      </div>

      {editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[var(--text-faint)] space-y-1">
              <span>Send all 3 by</span>
              <input type="date" value={dist} onChange={(e) => setDist(e.target.value)} className={INPUT} />
            </label>
            <label className="text-xs text-[var(--text-faint)] space-y-1">
              <span>Discount until</span>
              <input type="date" value={disc} onChange={(e) => setDisc(e.target.value)} className={INPUT} />
            </label>
          </div>
          <button type="button" onClick={saveDeadlines} className={PRIMARY}>Save deadlines</button>
        </div>
      )}

      {partner.notes && <p className="text-xs text-[var(--text-faint)] whitespace-pre-line">{partner.notes}</p>}

      <div className="divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)]">
        {partner.vouchers.map((v) => (
          <div key={v.code} className="py-1.5">
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-[var(--text-primary)] break-all">{v.code}</span>
              <CopyButton text={v.code} />
              {v.state === 'unused' && (
                <button type="button" onClick={() => revoke(v.code)} className="ml-auto shrink-0 text-xs text-[var(--danger-text)]">Revoke</button>
              )}
            </div>
            <p className={`text-xs ${STATE_STYLE[v.state]}`}>
              {v.state === 'redeemed' ? `Redeemed ${fmtDate(v.redeemed_at)}`
                : v.state === 'unused' && v.valid_until ? `Unused · redeemable until ${fmtDate(v.valid_until)}`
                  : v.state[0].toUpperCase() + v.state.slice(1)}
              {v.kind === 'purchased' ? ` · ${v.duration_months}-month pack` : ''}
            </p>
            {v.sent_to && (
              <p className="text-xs text-[var(--text-faint)] break-all">
                Sent to {v.sent_to} on {fmtDate(v.sent_at)}
              </p>
            )}
            {v.sent_to_other_businesses_too && (
              <p className="text-xs text-[var(--warn-text)]">This address has also had a voucher from another business.</p>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
    </div>
  )
}

export default function PartnersSection({ token, onSessionError }) {
  const [data, setData] = useState(null)

  function refetch() {
    api.admin.partners(token).then(setData, onSessionError)
  }

  useEffect(refetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (data === null) return <Loading inline />

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <Handshake size={13} strokeWidth={2} /> Partner businesses ({data.partners.length})
      </h2>
      <EnrolmentWindow token={token} settings={data.settings} onSaved={refetch} onSessionError={onSessionError} />
      <EnrolForm
        token={token} categories={data.categories} disabled={!data.settings.enrolment_open}
        onEnrolled={refetch} onSessionError={onSessionError}
      />
      {data.partners.length === 0 && <p className="text-xs text-[var(--text-faint)]">No partner businesses enrolled yet.</p>}
      {data.partners.map((p) => (
        <PartnerCard key={p.id} token={token} partner={p} onChanged={refetch} onSessionError={onSessionError} />
      ))}
    </div>
  )
}
