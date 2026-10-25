import { useMemo, useRef, useState } from 'react'
import { AtSign, Download, ExternalLink, Plus, Trash2, Upload } from 'lucide-react'
import { api, downloadOutreachExport } from '../api'
import Loading from '../components/Loading'
import PartnersSection from '../components/PartnersSection'
import {
  Card, ErrorNote, PageHeader, Segmented, StatTile, fmtDate, fmtNum, useAdminData, useSession,
} from '../components/ui'

// Partner outreach (Couple_finance_app server/outreach_service.py,
// 2026-10-25): the B2B lead list, its email sequence and the enrolled
// partner businesses. The server enforces the rules (only Ltd/LLP is
// emailed, sending window, daily cap, follow-ups, reply detection,
// do-not-contact list); this page only shows them and edits leads,
// templates and settings.

const FIELD = 'rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]'
// Full-width by default; FIELD alone where a control sets its own width.
const INPUT = `w-full ${FIELD}`
const BTN = 'inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-alt)] text-[var(--text-primary)] text-xs font-medium px-3 py-1.5 disabled:opacity-50'
const PRIMARY = 'rounded-lg gradient-accent text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50'

const STATUS_LABELS = {
  not_contacted: 'Not contacted', contacted: 'Contacted', follow_up_1_sent: 'Follow-up 1 sent',
  follow_up_2_sent: 'Follow-up 2 sent', replied: 'Replied', auto_reply: 'Auto-reply (check)',
  bounced: 'Bounced', enrolled: 'Enrolled', not_interested: 'Not interested', do_not_contact: 'Do not contact',
}
const STATUS_TONE = {
  replied: 'text-[var(--success-text)]', enrolled: 'text-[var(--success-text)]', auto_reply: 'text-[var(--warn-text)]',
  bounced: 'text-[var(--danger-text)]', do_not_contact: 'text-[var(--text-faint)]', not_interested: 'text-[var(--text-faint)]',
}
const OUTCOMES = ['', 'Interested', 'Call booked', 'Enrolled', 'Not now', 'Not interested', 'Asked to be removed']
const LEGAL_FORMS = ['Ltd', 'LLP', 'Ltd (verify)', 'Sole trader (likely)', 'Partnership (likely)', 'Unconfirmed']
const SHORT_CATEGORY = {
  ifa_mortgage_broker: 'IFAs & brokers', wedding_planner: 'Wedding planners', accountant: 'Accountants',
  estate_agent: 'Estate agents', wedding_venue_celebrant: 'Venues & celebrants',
}

function channel(lead) {
  if (lead.emailable) return { label: 'Email (automatic)', tone: 'text-[var(--success-text)]' }
  if (lead.email && lead.legal_form === 'Unconfirmed') return { label: 'Check legal form', tone: 'text-[var(--warn-text)]' }
  if (lead.linkedin || lead.instagram || lead.facebook) return { label: 'Manual: social', tone: 'text-[var(--text-secondary)]' }
  if (lead.phone || lead.website) return { label: 'Manual: phone or form', tone: 'text-[var(--text-secondary)]' }
  return { label: 'Find contact', tone: 'text-[var(--text-faint)]' }
}

function lastActivity(lead) {
  const [label, at] = lead.replied_at ? ['Replied', lead.replied_at]
    : lead.followup2_at ? ['Follow-up 2', lead.followup2_at]
      : lead.followup1_at ? ['Follow-up 1', lead.followup1_at]
        : lead.first_contact_at ? ['First email', lead.first_contact_at] : [null, null]
  return label ? `${label} ${fmtDate(at)}` : '—'
}

export default function Outreach() {
  const session = useSession()
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.outreach(t))
  const [tab, setTab] = useState('leads')

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />

  const leads = data.leads
  const count = (fn) => leads.filter(fn).length
  const { settings, gmail } = data

  return (
    <div className="space-y-5">
      <PageHeader title="Outreach" subtitle="Partner business leads, the email sequence and enrolled partners." updatedAt={updatedAt} loading={loading} onRefresh={reload}>
        <Segmented options={[['leads', 'Leads'], ['templates', 'Templates'], ['partners', 'Partners'], ['settings', 'Settings']]} value={tab} onChange={setTab} />
      </PageHeader>
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatTile label="Leads" value={fmtNum(leads.length)} sub={`${count((l) => l.emailable)} can be emailed`} />
        <StatTile label="Contacted" value={fmtNum(count((l) => l.step > 0))} />
        <StatTile label="Replied" value={fmtNum(count((l) => l.status === 'replied'))} tone={count((l) => l.status === 'replied') ? 'ok' : undefined} />
        <StatTile label="Enrolled" value={fmtNum(count((l) => l.status === 'enrolled'))} />
        <StatTile label="Sent today" value={`${data.sent_today} / ${settings.daily_cap}`} />
        <StatTile
          label="Sending" value={settings.sending_enabled ? 'On' : 'Off'}
          sub={gmail.configured ? `as ${gmail.from}` : 'Gmail not connected'}
          tone={settings.sending_enabled ? 'ok' : 'warn'} onClick={() => setTab('settings')}
        />
      </div>
      {count((l) => l.status === 'auto_reply') > 0 && (
        <p className="text-sm text-[var(--warn-text)]">
          {count((l) => l.status === 'auto_reply')} lead(s) sent an auto-reply. Their follow-ups are paused: check them and set the status.
        </p>
      )}

      {tab === 'leads' && <LeadsTab data={data} session={session} reload={reload} />}
      {tab === 'templates' && <TemplatesTab data={data} session={session} reload={reload} />}
      {tab === 'partners' && <Card><PartnersSection {...session} /></Card>}
      {tab === 'settings' && <SettingsTab data={data} session={session} reload={reload} />}
    </div>
  )
}

function LeadsTab({ data, session, reload }) {
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // lead | {} for new
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const rows = useMemo(() => data.leads.filter((l) =>
    (category === 'all' || l.category === category)
    && (status === 'all' || l.status === status)
    && (!query || `${l.business_name} ${l.town} ${l.email}`.toLowerCase().includes(query.toLowerCase())),
  ), [data.leads, category, status, query])

  async function run(fn, done) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fn()
      if (done) setMessage(done(result))
      await reload()
    } catch (err) {
      session.onSessionError(err)
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const update = (lead, body) => run(() => api.admin.updateLead(session.token, lead.id, body))

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            options={[['all', 'All'], ...Object.keys(SHORT_CATEGORY).map((k) => [k, SHORT_CATEGORY[k]])]}
            value={category} onChange={setCategory}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD} aria-label="Filter by status">
          <option value="all">Any status</option>
          {data.statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={`${FIELD} w-40`} aria-label="Search leads" />
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => setEditing({})}><Plus size={13} /> Add lead</button>
          <button type="button" className={BTN} disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={13} /> Import</button>
          <input
            ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) run(() => api.admin.importOutreach(session.token, file), (r) => `Imported: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}.`)
            }}
          />
          <button type="button" className={BTN} disabled={busy} onClick={() => run(() => downloadOutreachExport(session.token))}><Download size={13} /> Export</button>
        </div>
      </div>
      {message && <p className="text-xs text-[var(--text-secondary)]">{message}</p>}

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--text-muted)]">
              {['Business', '%', 'Channel', 'Status', 'Outcome', 'Last activity', 'Notes', ''].map((h) => (
                <th key={h} className="pb-2 pr-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const ch = channel(lead)
              return (
                <tr key={lead.id} className="border-t border-[var(--hairline)] align-top">
                  <td className="py-2 pr-3 min-w-[12rem] max-w-[16rem]">
                    <button type="button" onClick={() => setEditing(lead)} className="text-left font-medium text-[var(--text-primary)] hover:underline">
                      {lead.business_name}
                    </button>
                    <div className="text-[var(--text-faint)]">
                      {SHORT_CATEGORY[lead.category]}{lead.town ? ` · ${lead.town}` : ''} · {lead.legal_form}
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      {lead.website && <a className="text-[var(--info-text)]" href={lead.website} target="_blank" rel="noreferrer">Site</a>}
                      {lead.linkedin && <a className="text-[var(--info-text)]" href={lead.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                      {lead.instagram && <a className="text-[var(--info-text)]" href={lead.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                      {lead.facebook && <a className="text-[var(--info-text)]" href={lead.facebook} target="_blank" rel="noreferrer">Facebook</a>}
                      {lead.source && !lead.website && <a className="text-[var(--info-text)]" href={lead.source} target="_blank" rel="noreferrer">Listing</a>}
                    </div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{lead.likelihood}%</td>
                  <td className={`py-2 pr-3 whitespace-nowrap ${ch.tone}`}>{ch.label}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={lead.status} disabled={busy} aria-label={`Status for ${lead.business_name}`}
                      onChange={(e) => update(lead, { status: e.target.value })}
                      className={`${FIELD} w-40 ${STATUS_TONE[lead.status] || ''}`}
                    >
                      {data.statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={lead.outcome || ''} disabled={busy} aria-label={`Outcome for ${lead.business_name}`}
                      onChange={(e) => {
                        const outcome = e.target.value
                        if (outcome === 'Asked to be removed'
                          && !window.confirm(`Never contact ${lead.business_name} again? Their address goes on the permanent do-not-contact list.`)) return
                        update(lead, { outcome: outcome || null })
                      }}
                      className={`${FIELD} w-32`}
                    >
                      {OUTCOMES.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-[var(--text-secondary)]">{lastActivity(lead)}</td>
                  <td className="py-2 pr-3 min-w-[9rem]">
                    <textarea
                      defaultValue={lead.notes || ''} rows={1} aria-label={`Notes for ${lead.business_name}`}
                      onBlur={(e) => { if ((e.target.value || null) !== (lead.notes || null)) update(lead, { notes: e.target.value }) }}
                      className={`${INPUT} resize-y`}
                    />
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {lead.status !== 'enrolled' && lead.email && (
                      <button
                        type="button" className={PRIMARY} disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Enrol ${lead.business_name} as a partner business? This issues their 3 complimentary vouchers.`)) {
                            run(() => api.admin.enrolLead(session.token, lead.id), () => `${lead.business_name} enrolled. Their vouchers are on the Partners tab.`)
                          }
                        }}
                      >
                        Enrol
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-sm text-[var(--text-muted)]">No leads match. Import the lead-list workbook to get started.</p>}
      </div>

      {editing && (
        <LeadEditor
          lead={editing} categories={data.categories} session={session}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </Card>
  )
}

const LEAD_FIELDS = [
  ['business_name', 'Business name'], ['contact_name', 'Contact name'], ['email', 'Email'], ['phone', 'Phone'],
  ['town', 'Town / area'], ['company_no', 'Company number'], ['website', 'Website'], ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['source', 'Source (if not own site)'],
]

function LeadEditor({ lead, categories, session, onClose, onSaved }) {
  const isNew = !lead.id
  const [form, setForm] = useState({
    category: lead.category || 'ifa_mortgage_broker', legal_form: lead.legal_form || 'Unconfirmed',
    likelihood: lead.likelihood ?? 15, why: lead.why || '',
    ...Object.fromEntries(LEAD_FIELDS.map(([k]) => [k, lead[k] || ''])),
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isNew) await api.admin.addLead(session.token, form)
      else await api.admin.updateLead(session.token, lead.id, form)
      onSaved()
    } catch (err) {
      session.onSessionError(err)
      setError(err.message)
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${lead.business_name} from the lead list?`)) return
    try {
      await api.admin.deleteLead(session.token, lead.id)
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">{isNew ? 'Add a lead' : lead.business_name}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-[var(--text-muted)]">Category
            <select value={form.category} onChange={set('category')} className={INPUT}>
              {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-[var(--text-muted)]">Legal form
            <select value={form.legal_form} onChange={set('legal_form')} className={INPUT}>
              {LEGAL_FORMS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          {LEAD_FIELDS.map(([k, label]) => (
            <label key={k} className="space-y-1 text-xs text-[var(--text-muted)]">{label}
              <input value={form[k]} onChange={set(k)} className={INPUT} required={k === 'business_name'} />
            </label>
          ))}
          <label className="space-y-1 text-xs text-[var(--text-muted)]">Likelihood %
            <input type="number" min="0" max="100" value={form.likelihood} onChange={set('likelihood')} className={INPUT} />
          </label>
        </div>
        <label className="block space-y-1 text-xs text-[var(--text-muted)]">Why
          <textarea value={form.why} onChange={set('why')} rows={2} className={INPUT} />
        </label>
        <p className="text-xs text-[var(--text-faint)]">
          Only a Ltd or LLP with an email is emailed automatically. Sole traders and partnerships need their consent first, so contact them yourself.
        </p>
        {error && <p role="alert" className="text-xs text-[var(--danger-text)]">{error}</p>}
        <div className="flex items-center gap-2">
          {!isNew && <button type="button" onClick={remove} className={`${BTN} text-[var(--danger-text)]`}><Trash2 size={13} /> Delete</button>}
          <button type="button" onClick={onClose} className={`${BTN} ml-auto`}>Cancel</button>
          <button type="submit" disabled={saving} className={PRIMARY}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

function TemplatesTab({ data, session, reload }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        One three-email sequence per business type. Placeholders: {'{first_name}'}, {'{business_name}'}, {'{sender_name}'}.
        Follow-ups reply in the same thread, so they reuse the first email's subject. Your Gmail signature and the company footer
        (who we are, where we found their details, how to opt out) are added to every email automatically.
      </p>
      {Object.entries(data.categories).filter(([k]) => data.templates[k]).map(([key, label]) => (
        <Card key={key} title={label}>
          {[1, 2, 3].map((step) => (
            <TemplateEditor key={step} category={key} step={step} template={data.templates[key][step]} session={session} reload={reload} />
          ))}
        </Card>
      ))}
    </div>
  )
}

function TemplateEditor({ category, step, template, session, reload }) {
  const [subject, setSubject] = useState(template?.subject || '')
  const [body, setBody] = useState(template?.body || '')
  const [state, setState] = useState(null)
  const changed = subject !== (template?.subject || '') || body !== (template?.body || '')
  const label = ['First email', 'Follow-up 1 (4 working days later)', 'Follow-up 2 (10 working days after that)'][step - 1]

  async function save() {
    setState('saving')
    try {
      await api.admin.updateTemplate(session.token, category, step, { subject: step === 1 ? subject : null, body })
      setState('saved')
      reload()
    } catch (err) {
      session.onSessionError(err)
      setState(err.message)
    }
  }

  return (
    <div className="space-y-1.5 border-t border-[var(--hairline)] pt-3 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-xs text-[var(--text-faint)]">
          {state === 'saving' ? 'Saving…' : state === 'saved' && !changed ? 'Saved' : state && state !== 'saved' ? state : ''}
        </span>
      </div>
      {step === 1 && <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className={INPUT} />}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={step === 1 ? 10 : 5} aria-label={`${label} body`} className={`${INPUT} leading-relaxed`} />
      <button type="button" onClick={save} disabled={!changed || state === 'saving'} className={BTN}>Save</button>
    </div>
  )
}

function SettingsTab({ data, session, reload }) {
  const { settings, gmail } = data
  const [cap, setCap] = useState(String(settings.daily_cap))
  const [sender, setSender] = useState(settings.sender_name)
  const [footer, setFooter] = useState(settings.company_footer)
  const [message, setMessage] = useState(null)
  const footerUnfinished = /\[registered address\]/i.test(settings.company_footer)

  async function save(body, done) {
    setMessage(null)
    try {
      await api.admin.updateOutreachSettings(session.token, body)
      setMessage(done)
      reload()
    } catch (err) {
      session.onSessionError(err)
      setMessage(err.message)
    }
  }

  function toggleSending() {
    if (!settings.sending_enabled) {
      if (!gmail.configured) { setMessage('Connect Gmail first (see the setup guide).'); return }
      if (footerUnfinished) { setMessage('Add the registered address to the company footer before turning sending on.'); return }
      if (!window.confirm('Start sending? Emails go out on weekdays between 9am and 5pm, up to the daily limit.')) return
    }
    save({ sending_enabled: !settings.sending_enabled }, settings.sending_enabled ? 'Sending paused.' : 'Sending is on.')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card title="Sending">
        <p className="text-sm text-[var(--text-secondary)]">
          {settings.sending_enabled
            ? 'On. Emails go out on weekdays, 9am to 5pm UK time, up to the daily limit. Replies stop a lead’s follow-ups automatically.'
            : 'Off. Nothing is sent. Replies are still checked for leads already contacted.'}
        </p>
        <button type="button" onClick={toggleSending} className={settings.sending_enabled ? BTN : PRIMARY}>
          {settings.sending_enabled ? 'Pause sending' : 'Turn sending on'}
        </button>
        <label className="block space-y-1 text-xs text-[var(--text-muted)]">Daily limit
          <div className="flex gap-2">
            <input type="number" min="0" max="200" value={cap} onChange={(e) => setCap(e.target.value)} className={`${FIELD} w-24`} />
            <button type="button" className={BTN} onClick={() => save({ daily_cap: Number(cap) }, 'Daily limit saved.')}>Save</button>
          </div>
        </label>
        {message && <p className="text-xs text-[var(--text-secondary)]">{message}</p>}
      </Card>

      <Card title="Gmail">
        {gmail.configured ? (
          <p className="text-sm text-[var(--text-secondary)]">
            <AtSign size={13} className="inline -mt-0.5" /> Connected: sending as <strong>{gmail.from}</strong> from {gmail.mailbox}.
          </p>
        ) : (
          <p className="text-sm text-[var(--warn-text)]">
            Not connected. Follow the one-time setup in docs/OUTREACH_SETUP.md, then set the Gmail variables on Railway.
          </p>
        )}
        <a className="inline-flex items-center gap-1 text-xs text-[var(--info-text)]" target="_blank" rel="noreferrer"
          href="https://github.com/jeffnet-ltd/Couple_finance_app/blob/master/docs/OUTREACH_SETUP.md">
          Setup guide <ExternalLink size={12} />
        </a>
        <p className="text-xs text-[var(--text-faint)]">{fmtNum(data.suppressed_count)} address(es) on the do-not-contact list.</p>
      </Card>

      <Card title="Sign-off and footer" className="lg:col-span-2">
        <label className="block space-y-1 text-xs text-[var(--text-muted)]">Sign-off name
          <input value={sender} onChange={(e) => setSender(e.target.value)} className={`${FIELD} block w-full max-w-xs`} />
        </label>
        <label className="block space-y-1 text-xs text-[var(--text-muted)]">Company footer (who the email is from: legally required)
          <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} className={INPUT} />
        </label>
        {footerUnfinished && <p className="text-xs text-[var(--warn-text)]">Replace [registered address] before sending starts.</p>}
        <p className="text-xs text-[var(--text-faint)]">
          Every email also ends with: “I found your details on [their website]. If you’d rather not hear from us, reply ‘no thanks’ and we won’t contact you again.”
        </p>
        <button type="button" className={BTN} onClick={() => save({ sender_name: sender, company_footer: footer }, 'Saved.')}>Save</button>
      </Card>
    </div>
  )
}
