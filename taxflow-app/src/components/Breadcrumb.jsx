import { Link } from 'react-router-dom'

export default function Breadcrumb({ segments = [] }) {
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-[12px] font-medium mb-4"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1

        return (
          <span key={segment.path} className="flex items-center gap-1.5">
            {index > 0 && (
              <span className="text-[var(--color-on-surface-variant)] opacity-40 select-none">
                ›
              </span>
            )}
            {isLast ? (
              <span
                className="text-[var(--color-on-surface)] opacity-70"
                aria-current="page"
              >
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.path}
                className="text-[var(--color-primary)] hover:text-[var(--color-on-surface)] transition-colors duration-200 no-underline"
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
