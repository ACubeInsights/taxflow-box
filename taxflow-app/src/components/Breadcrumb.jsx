import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * Breadcrumb — Client → Project → Document trail.
 * Last segment is current page (non-link).
 */
export default function Breadcrumb({ segments = [] }) {
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-[var(--space-1)] text-xs font-medium mb-[var(--space-4)] flex-wrap"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        return (
          <span key={`${segment.path}-${index}`} className="flex items-center gap-[var(--space-1)]">
            {index > 0 && (
              <ChevronRight
                size={12}
                className="text-[var(--color-whisper)] shrink-0"
                aria-hidden
              />
            )}
            {isLast ? (
              <span className="text-[var(--color-ink)] font-medium" aria-current="page">
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.path}
                className="text-[var(--color-whisper)] hover:text-[var(--color-ink)] no-underline"
              >
                {segment.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
