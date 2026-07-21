import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

/**
 * Breadcrumb — animated navigation trail.
 * segments: [{ label: string, path: string }]
 * Last segment is the current page (non-interactive).
 */
export default function Breadcrumb({ segments = [] }) {
  if (segments.length === 0) return null

  return (
    <motion.nav
      aria-label="Breadcrumb"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-1 text-[12px] font-medium mb-4 flex-wrap"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1

        return (
          <span key={`${segment.path}-${index}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                size={12}
                className="text-[var(--color-on-surface-variant)] shrink-0"
                style={{ opacity: 0.35 }}
              />
            )}
            {isLast ? (
              <span
                className="text-[var(--color-on-surface)] font-semibold"
                style={{ opacity: 0.75 }}
                aria-current="page"
              >
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.path}
                className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors duration-150 no-underline"
              >
                {segment.label}
              </Link>
            )}
          </span>
        )
      })}
    </motion.nav>
  )
}
