// Workstream I stage I7: replaces the coloured-circle status emoji used
// across the Dev Zone, connection rows and pot sync badges. A small filled
// dot in a semantic colour -- theme-aware, unambiguous, and the same size
// everywhere.
const TONE = {
  ok: 'bg-[var(--success-text)]',
  warn: 'bg-[var(--warn-text)]',
  error: 'bg-[var(--danger-text)]',
  idle: 'bg-[var(--text-faint)]',
}

export default function StatusDot({ tone = 'idle', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${TONE[tone] ?? TONE.idle} ${className}`}
    />
  )
}
