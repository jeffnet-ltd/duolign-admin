import Spinner from './Spinner'

// Workstream I stage I1 -- one loading treatment. Before this, "still
// fetching" was a bare `<p>Loading…</p>` on some screens, a blank
// `min-h-screen` div on others, and a couple of one-off "Checking…"
// strings -- so a slow connection showed three different things depending
// on which page you opened.
//
//   <Loading />            full-page: a centred spinner + label, for the
//                          first paint of a route before its data lands.
//   <Loading inline />     a small spinner + faint label, for a section
//                          inside an already-rendered page (Settings cards).
export default function Loading({ label = 'Loading…', inline = false }) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 py-2 text-[var(--text-faint)]">
        <Spinner size={14} />
        <span className="text-sm">{label}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-[var(--text-muted)]">
      <Spinner size={22} />
      <span className="text-sm">{label}</span>
    </div>
  )
}
