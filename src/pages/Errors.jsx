import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { api } from '../api'
import { Bars, Sparkline, dayLabel } from '../components/Charts'
import Loading from '../components/Loading'
import {
  Card, Empty, ErrorNote, ExtLink, PageHeader, Segmented, StatTile, fmtDate, fmtNum, timeAgo, useAdminData,
} from '../components/ui'

// Sentry issues from the app and the backend, read through the server
// (the Sentry token never reaches the browser). Read-only: resolving or
// ignoring an issue is still done in Sentry.

const LEVEL = { fatal: 'text-[var(--danger-text)]', error: 'text-[var(--danger-text)]', warning: 'text-[var(--warn-text)]' }

function IssueDetail({ id, onBack }) {
  const { data, error } = useAdminData((t) => api.admin.errorDetail(t, id), [id])
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--info-text)]">
        <ChevronLeft size={16} /> All issues
      </button>
      <ErrorNote>{error}</ErrorNote>
      {!data ? (!error && <Loading inline />) : (
        <>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">{data.short_id} · {data.project} · {data.level}</p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] break-words">{data.title}</h1>
            {data.culprit && <p className="text-sm text-[var(--text-muted)] break-words">{data.culprit}</p>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Events" value={fmtNum(data.count)} />
            <StatTile label="People affected" value={fmtNum(data.users)} />
            <StatTile label="First seen" value={timeAgo(data.first_seen)} sub={fmtDate(data.first_seen, true)} />
            <StatTile label="Last seen" value={timeAgo(data.last_seen)} sub={fmtDate(data.last_seen, true)} />
          </div>
          {data.trend?.length > 0 && (
            <Card title="Events per day (14 days)">
              <Bars series={data.trend.map((v, i) => ({ label: `${data.trend.length - i - 1}d ago`, short: '', value: v }))} colors={['var(--danger)']} height={80} />
            </Card>
          )}
          <Card title="Latest event" action={data.permalink && <ExtLink href={data.permalink}>Open in Sentry</ExtLink>}>
            <p className="text-xs text-[var(--text-faint)]">{fmtDate(data.event.date, true)}</p>
            {data.event.exception && (
              <p className="font-mono text-sm text-[var(--danger-text)] break-words">
                {data.event.exception.type}: {data.event.exception.value}
              </p>
            )}
            {data.event.message && !data.event.exception && <p className="text-sm text-[var(--text-secondary)]">{data.event.message}</p>}
            {data.event.frames.length > 0 && (
              <div className="rounded-lg bg-[var(--bg-solid)] p-3 space-y-1.5 overflow-x-auto">
                {data.event.frames.map((f, i) => (
                  <div key={i} className="font-mono text-xs">
                    <span className="text-[var(--text-primary)]">{f.function || '(anonymous)'}</span>{' '}
                    <span className="text-[var(--text-muted)]">{f.file}{f.line ? `:${f.line}` : ''}</span>
                    {f.context?.[0] && <pre className="text-[var(--text-faint)] whitespace-pre-wrap">{f.context[0].trim()}</pre>}
                  </div>
                ))}
              </div>
            )}
            {data.event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.event.tags.map((t) => (
                  <span key={t.key} className="rounded-md bg-[var(--surface-alt)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">{t.key}:</span> {t.value}
                  </span>
                ))}
              </div>
            )}
          </Card>
          {data.event.breadcrumbs.length > 0 && (
            <Card title="What happened just before">
              <ol className="space-y-1">
                {data.event.breadcrumbs.map((b, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="text-[var(--text-faint)] shrink-0 tabular-nums">{b.time ? new Date(b.time).toLocaleTimeString('en-GB') : ''}</span>
                    <span className="text-[var(--text-muted)] shrink-0">{b.category}</span>
                    <span className="text-[var(--text-secondary)] min-w-0 break-words">{b.message}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default function Errors() {
  const [status, setStatus] = useState('is:unresolved')
  const [period, setPeriod] = useState('14d')
  const [sort, setSort] = useState('date')
  const [openId, setOpenId] = useState(null)
  const { data, error, loading, updatedAt, reload } = useAdminData(
    (t) => api.admin.errors(t, { query: status, period, sort }), [status, period, sort], { poll: 120_000 },
  )

  if (openId) return <IssueDetail id={openId} onBack={() => setOpenId(null)} />
  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />

  if (!data.configured) {
    return (
      <div className="space-y-5">
        <PageHeader title="Errors" subtitle="Crashes and exceptions from Sentry." />
        <Card title="Connect Sentry">
          <p className="text-sm text-[var(--text-secondary)]">Set these on the Railway service and redeploy:</p>
          <ul className="text-sm text-[var(--text-muted)] space-y-1 list-disc pl-5">
            <li><code className="text-[var(--text-secondary)]">SENTRY_AUTH_TOKEN</code>: a Sentry internal integration (or personal) token with org:read, project:read and event:read</li>
            <li><code className="text-[var(--text-secondary)]">SENTRY_ORG</code>: your organisation slug (in the Sentry URL)</li>
          </ul>
        </Card>
      </div>
    )
  }

  const issues = data.issues || []
  const day = Date.now() - 86_400_000
  return (
    <div className="space-y-5">
      <PageHeader title="Errors" subtitle="Crashes and exceptions from the app and the backend, via Sentry." updatedAt={updatedAt} loading={loading} onRefresh={reload} />
      <ErrorNote>{error || data.error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Issues listed" value={fmtNum(issues.length)} sub={status === 'is:unresolved' ? 'unresolved' : 'any status'} />
        <StatTile label="New in 24h" value={fmtNum(issues.filter((i) => new Date(i.first_seen) > day).length)} tone={issues.some((i) => new Date(i.first_seen) > day) ? 'warn' : 'ok'} />
        <StatTile label="Seen in 24h" value={fmtNum(issues.filter((i) => new Date(i.last_seen) > day).length)} />
        <StatTile label="People affected" value={fmtNum(issues.reduce((t, i) => t + (i.users || 0), 0))} sub="across listed issues" />
      </div>

      {data.events_per_day && (
        <Card title="Error events per day (14 days)">
          <Bars series={data.events_per_day.map((d) => ({ label: dayLabel(d.date), value: d.value }))} colors={['var(--danger)']} height={100} />
        </Card>
      )}

      <Card
        title="Issues"
        action={(
          <div className="flex flex-wrap gap-2 justify-end">
            <Segmented options={[['is:unresolved', 'Unresolved'], ['', 'All']]} value={status} onChange={setStatus} />
            <Segmented options={['24h', '7d', '14d', '30d']} value={period} onChange={setPeriod} />
            <Segmented options={[['date', 'Latest'], ['new', 'Newest'], ['freq', 'Most events'], ['user', 'Most people']]} value={sort} onChange={setSort} />
          </div>
        )}
      >
        {issues.length === 0 ? <Empty>No issues in this period. Good.</Empty> : (
          <ul className="divide-y divide-[var(--hairline)] -mx-1">
            {issues.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setOpenId(i.id)} className="w-full flex items-center gap-3 px-1 py-2.5 text-left hover:bg-[var(--surface-alt)]/40 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${LEVEL[i.level] || 'text-[var(--text-primary)]'}`}>{i.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {i.short_id} · {i.project}{i.culprit ? ` · ${i.culprit}` : ''}
                    </p>
                    <p className="text-xs text-[var(--text-faint)]">
                      {fmtNum(i.count)} events · {fmtNum(i.users)} people · last {timeAgo(i.last_seen)} · first {timeAgo(i.first_seen)}
                    </p>
                  </div>
                  <Sparkline values={i.trend} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
