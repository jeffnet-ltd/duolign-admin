import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api } from '../api'
import Loading from '../components/Loading'
import {
  Card, Empty, ErrorNote, PageHeader, StatTile, StatusBadge, fmtNum, timeAgo, useAdminData, useSession,
} from '../components/ui'

// Scheduled social posts (Couple_finance_app server/social_service.py,
// 2026-10-28). The content engine's `schedule` command puts a rendered
// month here; the worker publishes each post to Instagram at its time
// unless it's pulled. Watch every video and read the caption first.

const BTN = 'inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-alt)] text-[var(--text-primary)] text-xs font-medium px-3 py-1.5 disabled:opacity-50'
const STATUS = {
  scheduled: ['info', 'Scheduled'],
  processing: ['info', 'Going out now'],
  published: ['ok', 'Published'],
  pulled: ['unconfigured', 'Pulled'],
  failed: ['down', 'Failed'],
  missed: ['warn', 'Missed'],
}
const when = (iso) => new Date(iso).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
})
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })

export default function Scheduled() {
  const session = useSession()
  const { data, error, loading, updatedAt, reload } = useAdminData((t) => api.admin.social(t), [], { poll: 60000 })
  const [tab, setTab] = useState('upcoming')

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />

  const now = Date.now()
  const upcoming = data.posts.filter((p) => ['scheduled', 'processing', 'pulled', 'failed', 'missed'].includes(p.status)
    && (new Date(p.scheduled_at).getTime() > now - 6 * 3600e3 || p.status !== 'pulled'))
  const done = data.posts.filter((p) => p.status === 'published').reverse()
  const next = data.posts.find((p) => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() > now)
  const attention = data.posts.filter((p) => p.status === 'failed' || p.status === 'missed')
  const list = tab === 'upcoming' ? upcoming : done
  const groups = list.reduce((acc, p) => {
    const k = dayKey(p.scheduled_at)
    ;(acc[k] = acc[k] || []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <PageHeader title="Scheduled" subtitle="Instagram posts going out from the content engine. Pull anything you don't want to go out." updatedAt={updatedAt} loading={loading} onRefresh={reload}>
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-alt)] p-0.5">
          {[['upcoming', 'Upcoming'], ['done', 'Published']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${tab === v ? 'bg-[var(--surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{l}</button>
          ))}
        </div>
      </PageHeader>
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Next post" value={next ? when(next.scheduled_at) : 'None'} sub={next ? next.pillar : 'Nothing scheduled'} />
        <StatTile label="Scheduled" value={fmtNum(data.posts.filter((p) => p.status === 'scheduled').length)} />
        <StatTile label="Published (30 days)" value={fmtNum(done.length)} />
        <StatTile label="Instagram" value={data.instagram.connected ? 'Connected' : 'Not connected'}
          sub={!data.instagram.connected ? 'Set INSTAGRAM_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN'
            : data.instagram.renews_automatically === false ? "Token won't renew itself: add META_APP_ID and META_APP_SECRET to the worker"
              : data.instagram.token_refreshed_at ? `Token renewed ${timeAgo(data.instagram.token_refreshed_at)}` : 'Connected'}
          tone={!data.instagram.connected || data.instagram.renews_automatically === false ? 'warn' : 'ok'} />
      </div>
      {attention.length > 0 && (
        <p className="text-sm text-[var(--warn-text)]">
          {attention.length} post(s) didn't go out. Open them below to post now or leave them.
        </p>
      )}

      {list.length === 0 && (
        <Card><Empty>{tab === 'upcoming' ? 'Nothing scheduled. Run "python generate.py schedule" in the content engine.' : 'Nothing published in the last 30 days.'}</Empty></Card>
      )}
      {Object.entries(groups).map(([day, posts]) => (
        <section key={day} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{day}</h2>
          {posts.map((p) => <PostCard key={p.id} post={p} session={session} reload={reload} />)}
        </section>
      ))}
    </div>
  )
}

function PostCard({ post: p, session, reload }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [tone, label] = STATUS[p.status] || ['unconfigured', p.status]
  const reel = p.kind === 'reel'

  async function act(fn) {
    setBusy(true)
    setMessage(null)
    try {
      await fn(session.token, p.id)
      await reload()
    } catch (err) {
      session.onSessionError(err)
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{when(p.scheduled_at)} · {reel ? 'Reel' : `Carousel, ${p.media.length} slides`}</p>
          <p className="text-xs text-[var(--text-muted)]">{p.pillar}</p>
        </div>
        <StatusBadge status={tone} label={label} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {p.media.map((m, i) => (
          <video key={m.url} src={m.url} controls playsInline preload="metadata"
            aria-label={reel ? 'The reel' : `Slide ${i + 1}`}
            className={`shrink-0 rounded-lg bg-[var(--surface-alt)] ${reel ? 'w-44 aspect-[9/16]' : 'w-40 aspect-[4/5]'}`} />
        ))}
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">Caption</summary>
        <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{p.caption}</p>
      </details>

      {p.error && <p className="text-xs text-[var(--danger-text)]">{p.error}</p>}
      {message && <p className="text-xs text-[var(--danger-text)]">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {p.status === 'scheduled' && <button type="button" className={BTN} disabled={busy} onClick={() => act(api.admin.pullSocial)}>Pull</button>}
        {p.status === 'pulled' && <button type="button" className={BTN} disabled={busy} onClick={() => act(api.admin.restoreSocial)}>Put back on the schedule</button>}
        {['missed', 'failed', 'pulled'].includes(p.status) && (
          <button type="button" className={BTN} disabled={busy} onClick={() => act(api.admin.postSocialNow)}>Post now</button>
        )}
        {['missed', 'failed'].includes(p.status) && <button type="button" className={BTN} disabled={busy} onClick={() => act(api.admin.pullSocial)}>Leave it</button>}
        {p.permalink && (
          <a href={p.permalink} target="_blank" rel="noreferrer" className={BTN}><ExternalLink size={13} /> View on Instagram</a>
        )}
      </div>
    </Card>
  )
}
