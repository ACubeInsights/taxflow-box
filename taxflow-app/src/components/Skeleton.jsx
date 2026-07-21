/**
 * Skeleton — shimmer placeholder components for loading states.
 * Uses the .skeleton utility class defined in index.css.
 *
 * Components:
 *   SkeletonLine   — single text-line placeholder
 *   SkeletonCard   — full card block placeholder
 *   SkeletonRow    — single list-row placeholder
 *   SkeletonAvatar — circular avatar placeholder
 */

export function SkeletonLine({ width = 'w-full', height = 'h-3' }) {
  return <div className={`skeleton rounded-full ${width} ${height}`} />
}

export function SkeletonCard({ height = 'h-32' }) {
  return <div className={`skeleton rounded-xl ${height} w-full`} />
}

export function SkeletonRow({ count = 4 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton rounded-xl h-14 w-full" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 'w-10 h-10' }) {
  return <div className={`skeleton rounded-full ${size} shrink-0`} />
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5 space-y-3">
      <SkeletonLine width="w-24" height="h-2.5" />
      <SkeletonLine width="w-16" height="h-7" />
      <SkeletonLine width="w-20" height="h-2" />
    </div>
  )
}
