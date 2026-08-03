/**
 * Skeleton — shimmer placeholder components for loading states.
 * Uses the .skeleton utility class defined in index.css.
 */

export function SkeletonLine({ width = 'w-full', height = 'h-3' }) {
  return <div className={`skeleton rounded-full ${width} ${height}`} />
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
