import { api } from '../api'
import Loading from '../components/Loading'
import {
  Card, ErrorNote, ExtLink, PageHeader, StatusBadge, fmtDate, statusStyle, timeAgo, useAdminData,
} from '../components/ui'

// Every backend service with a verdict, not just raw numbers. Built
// after Railway paused deploys and nobody noticed for a day: "Deploys"
// compares the live commit with GitHub and reads Railway's own
// deployment list.

const DASHBOARDS = {
  deploys: 'https://railway.com/dashboard',
  api: 'https://railway.com/dashboard',
  worker: 'https://railway.com/dashboard',
  database: 'https://supabase.com/dashboard/project/jqvknxxpeqlcmehheaaq',
  email: 'https://resend.com/emails',
  payments: 'https://dashboard.stripe.com',
  llm: 'https://www.console.runpod.io/serverless',
  errors: 'https://sentry.io',
}

// Which server env var switches each check on, shown when it's off.
const SETUP = {
  deploys: [
    ['MONITOR_GITHUB_TOKEN', 'GitHub fine-grained token, read-only Contents + Actions + Metadata on Couple_finance_app'],
    ['RAILWAY_MONITOR_PROJECT_TOKEN', 'Railway project token for the production environment'],
  ],
  errors: [
    ['SENTRY_AUTH_TOKEN', 'Sentry internal integration or personal token: org:read, project:read, event:read'],
    ['SENTRY_ORG', 'Your Sentry organisation slug'],
  ],
  email: [['RESEND_MONITOR_API_KEY', 'Optional full-access Resend key, to check domain verification']],
}

function Kv({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--text-secondary)] text-right min-w-0 break-words tabular-nums">{children}</span>
    </div>
  )
}

function StatusPage({ page }) {
  if (!page) return null
  return <Kv label="Provider status">{page.indicator === 'none' ? 'No incidents' : page.description}</Kv>
}

function ServiceDetail({ s }) {
  const d = s.detail || {}
  switch (s.key) {
    case 'deploys':
      return (
        <div className="space-y-2">
          <Kv label="Live commit"><code>{d.deployed_commit || 'unknown'}</code></Kv>
          {d.head_commit && <Kv label={`Latest on ${d.branch}`}><code>{d.head_commit}</code> {d.head_message}</Kv>}
          {d.ci && <Kv label="CI on latest">{d.ci}</Kv>}
          {d.commits_behind > 0 && (
            <div className="rounded-lg bg-[var(--surface-alt)]/50 p-2.5 space-y-1">
              <p className="text-xs font-medium text-[var(--text-secondary)]">Merged but not live ({d.commits_behind})</p>
              {d.undeployed?.map((c) => (
                <p key={c.commit} className="text-xs text-[var(--text-muted)] truncate">
                  <code className="text-[var(--text-secondary)]">{c.commit}</code> {c.message} · {timeAgo(c.date)}
                </p>
              ))}
            </div>
          )}
          {d.deployments?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-secondary)]">Recent Railway deploys</p>
              {d.deployments.map((dep) => (
                <p key={dep.id} className="text-xs text-[var(--text-muted)] truncate">
                  <span className={dep.status === 'SUCCESS' ? 'text-[var(--success-text)]' : ['FAILED', 'CRASHED'].includes(dep.status) ? 'text-[var(--danger-text)]' : 'text-[var(--warn-text)]'}>
                    {dep.status.toLowerCase()}
                  </span>{' '}
                  <code>{dep.commit}</code> {dep.message} · {timeAgo(dep.created_at)}
                </p>
              ))}
            </div>
          )}
          {d.github && <p className="text-xs text-[var(--text-faint)]">{d.github}</p>}
          {d.railway && <p className="text-xs text-[var(--text-faint)]">{d.railway}</p>}
        </div>
      )
    case 'api':
      return (
        <div className="space-y-1.5">
          <Kv label="Commit"><code>{d.commit || 'unknown'}</code></Kv>
          {d.region && <Kv label="Region">{d.region}</Kv>}
          <Kv label="Up since">{fmtDate(d.up_since, true)}</Kv>
          <Kv label="Requests (24h)">{d.requests_24h} · {d.server_errors_24h} server errors</Kv>
        </div>
      )
    case 'worker':
      return (
        <div className="space-y-1.5">
          <Kv label="Last cycle">{d.last_cycle ? `${fmtDate(d.last_cycle, true)} (${timeAgo(d.last_cycle)})` : 'never'}</Kv>
          <Kv label="Runs every">{d.interval_seconds ? `${Math.round(d.interval_seconds / 60)} min` : '—'}</Kv>
          {d.failed_cycles_24h != null && <Kv label="Failed cycles (24h)">{d.failed_cycles_24h}</Kv>}
          {!d.last_cycle && (
            <p className="text-xs text-[var(--text-faint)]">
              The worker is a second Railway service with PA_ROLE=worker (docs/DEPLOY.md step 5). Without it, expiry
              and retention sweeps, statement reminders and low-pot alerts don't run.
            </p>
          )}
        </div>
      )
    case 'database':
      return (
        <div className="space-y-1.5">
          {d.latency_ms != null && <Kv label="Round trip">{d.latency_ms} ms</Kv>}
          {d.connections != null && <Kv label="Connections">{d.connections} of {d.max_connections}</Kv>}
          {d.size_mb != null && <Kv label="Database size">{d.size_mb} MB</Kv>}
          <StatusPage page={d.status_page} />
        </div>
      )
    case 'email':
      return (
        <div className="space-y-1.5">
          {d.domains?.map((dm) => <Kv key={dm.name} label={dm.name}>{dm.status}{dm.region ? ` · ${dm.region}` : ''}</Kv>)}
          {d.domains_note && <p className="text-xs text-[var(--text-faint)]">{d.domains_note}</p>}
          <StatusPage page={d.status_page} />
        </div>
      )
    case 'payments':
      return (
        <div className="space-y-1.5">
          {d.live_mode != null && <Kv label="Mode">{d.live_mode ? 'Live' : 'Test'}</Kv>}
          <StatusPage page={d.status_page} />
        </div>
      )
    case 'llm':
      return d.workers ? (
        <div className="space-y-1.5">
          <Kv label="Workers">
            idle {d.workers.idle ?? 0} · ready {d.workers.ready ?? 0} · running {d.workers.running ?? 0} · throttled {d.workers.throttled ?? 0} · unhealthy {d.workers.unhealthy ?? 0}
          </Kv>
          <Kv label="Jobs">
            completed {d.jobs.completed ?? 0} · failed {d.jobs.failed ?? 0} · queued {d.jobs.inQueue ?? 0}
          </Kv>
        </div>
      ) : null
    case 'errors':
      return (
        <div className="space-y-1.5">
          {d.unresolved != null && <Kv label="Unresolved issues">{d.unresolved}</Kv>}
          {d.active_issues_24h != null && <Kv label="Seen in last 24h">{d.active_issues_24h}</Kv>}
          <StatusPage page={d.status_page} />
        </div>
      )
    default:
      return null
  }
}

export default function Services() {
  const { data, error, loading, updatedAt, reload } = useAdminData((t, opts) => api.admin.services(t, opts?.refresh), [], { poll: 60_000 })

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />
  const order = { down: 0, warn: 1, ok: 2, unconfigured: 3 }
  const services = [...data.services].sort((x, y) => order[x.status] - order[y.status])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Services" subtitle="Each check runs on the server, at most once a minute."
        updatedAt={updatedAt} loading={loading} onRefresh={() => reload({ refresh: true })}
      >
        <StatusBadge status={data.overall} label={data.overall === 'ok' ? 'All healthy' : undefined} />
      </PageHeader>
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {services.map((s) => (
          <Card
            key={s.key} className={s.status === 'down' ? 'border-[var(--danger-text)]' : ''}
            title={<span className="flex items-center gap-2">{s.name}</span>}
            action={<StatusBadge status={s.status} />}
          >
            <p className={`text-sm ${s.status === 'ok' || s.status === 'unconfigured' ? 'text-[var(--text-secondary)]' : statusStyle(s.status).text}`}>
              {s.summary}
            </p>
            <ServiceDetail s={s} />
            {s.status === 'unconfigured' && SETUP[s.key] && (
              <div className="rounded-lg bg-[var(--surface-alt)]/50 p-2.5 space-y-1">
                <p className="text-xs font-medium text-[var(--text-secondary)]">To connect, set on Railway:</p>
                {SETUP[s.key].map(([name, what]) => (
                  <p key={name} className="text-xs text-[var(--text-muted)]"><code className="text-[var(--text-secondary)]">{name}</code>: {what}</p>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-[var(--text-faint)]">Checked {timeAgo(s.checked_at)}</span>
              {DASHBOARDS[s.key] && <ExtLink href={DASHBOARDS[s.key]}>Open dashboard</ExtLink>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
