import { api } from '../api'
import AdminMetricChart from '../components/AdminMetricChart'
import { Bars, hourLabel } from '../components/Charts'
import Loading from '../components/Loading'
import {
  Card, ErrorNote, PageHeader, StatTile, StatusBadge, Table, fmtDate, fmtNum, timeAgo, useAdminData, useSession,
} from '../components/ui'
import LogsSection from '../sections/LogsSection'

// How the app itself is coping: API traffic and errors, the background
// worker, PDF reading, every household's sync, and the raw log.
// Request numbers are counted in memory by the web service, so they
// start again from zero after each deploy.
export default function AppHealth() {
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.appMetrics(t), [], { poll: 60_000 })
  const { token } = useSession()

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />
  const r = data.requests
  const sync = Array.isArray(data.sync) ? data.sync : []
  const avg = r.series.filter((h) => h.avg_ms != null)
  const avgMs = avg.length ? Math.round(avg.reduce((t, h) => t + h.avg_ms * h.requests, 0) / Math.max(1, avg.reduce((t, h) => t + h.requests, 0))) : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="App health" subtitle={`API numbers since the last deploy (${fmtDate(r.started_at, true)}).`}
        updatedAt={updatedAt} loading={loading} onRefresh={reload}
      />
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Requests (24h)" value={fmtNum(r.requests_24h)} sub={`${fmtNum(r.requests_last_hour)} in the last hour`} />
        <StatTile
          label="Server errors (24h)" value={fmtNum(r.server_errors_24h)}
          sub={r.error_rate_24h == null ? 'no traffic yet' : `${r.error_rate_24h}% of requests`} tone={r.server_errors_24h ? 'warn' : 'ok'}
        />
        <StatTile label="Average response" value={avgMs == null ? '—' : `${avgMs} ms`} sub="last 24 hours" tone={avgMs > 1000 ? 'warn' : undefined} />
        <StatTile
          label="Households syncing" value={`${sync.filter((h) => !h.any_stale && !h.error).length}/${sync.length}`}
          sub={sync.some((h) => h.any_stale || h.error) ? 'some are stale' : 'all fresh'} tone={sync.some((h) => h.any_stale || h.error) ? 'warn' : undefined}
        />
      </div>

      <Card title="API traffic, by hour">
        <Bars
          series={r.series.map((h) => ({
            label: hourLabel(h.hour), short: hourLabel(h.hour),
            parts: { OK: h.requests - h.server_errors - h.client_errors, 'Client errors (4xx)': h.client_errors, 'Server errors (5xx)': h.server_errors },
          }))}
          stack={['OK', 'Client errors (4xx)', 'Server errors (5xx)']} colors={['var(--chart-1)', 'var(--warning)', 'var(--danger)']} height={130}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Slowest endpoints">
          <Table
            rows={r.slowest_routes} empty="No traffic recorded yet."
            columns={[
              { key: 'route', label: 'Endpoint', className: 'font-mono text-xs break-all' },
              { key: 'avg_ms', label: 'Avg', align: 'right', render: (x) => `${x.avg_ms} ms` },
              { key: 'max_ms', label: 'Max', align: 'right', render: (x) => `${x.max_ms} ms` },
              { key: 'requests', label: 'Calls', align: 'right' },
            ]}
          />
        </Card>
        <Card title="Endpoints with server errors">
          <Table
            rows={r.failing_routes} empty="No server errors since the last deploy."
            columns={[
              { key: 'route', label: 'Endpoint', className: 'font-mono text-xs break-all' },
              { key: 'server_errors', label: 'Errors', align: 'right' },
              { key: 'requests', label: 'Calls', align: 'right' },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[data.worker, data.llm].map((s) => (
          <Card key={s.key} title={s.name} action={<StatusBadge status={s.status} />}>
            <p className="text-sm text-[var(--text-secondary)]">{s.summary}</p>
            {s.detail?.last_cycle && <p className="text-xs text-[var(--text-faint)]">Last cycle {timeAgo(s.detail.last_cycle)}</p>}
          </Card>
        ))}
        {!data.uptime.error && (
          <AdminMetricChart
            title="Worker cycles completed (30 days)" color="var(--chart-3)"
            value={data.uptime.current == null ? '—' : `${data.uptime.current}%`} changePct={data.uptime.change_pct} series={data.uptime.series}
          />
        )}
        <Card title="Sync, every household">
          <Table
            rows={sync} rowKey={(h) => h.household_id} empty="No real households yet."
            columns={[
              { key: 'display_name', label: 'Household' },
              {
                key: 'state', label: 'State',
                // Names the steps that are behind (2026-10-23), not just "Stale".
                render: (h) => (
                  <div className="space-y-1">
                    <StatusBadge status={h.error || h.any_stale ? 'warn' : 'ok'} label={h.error ? 'Couldn’t read' : h.any_stale ? 'Behind' : 'Fresh'} />
                    {h.error && <p className="text-xs text-[var(--text-muted)] break-words">{h.error}</p>}
                    {!h.error && h.behind?.length > 0 && <p className="text-xs text-[var(--text-muted)]">{h.behind.join(', ')}</p>}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Card><LogsSection token={token} /></Card>
    </div>
  )
}
