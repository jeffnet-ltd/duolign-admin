// Themed loading indicator -- Tailwind's built-in animate-spin, no custom
// CSS needed. Used in place of a value that's mid-refetch (see
// ProgressRing.jsx's `loading` prop).
export default function Spinner({ size = 20 }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block rounded-full border-2 border-[var(--surface-border)] border-t-[var(--info-text)] animate-spin"
      style={{ width: size, height: size }}
    />
  )
}
