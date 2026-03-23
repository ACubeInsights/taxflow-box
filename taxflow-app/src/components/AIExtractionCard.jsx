import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const MOCK_EXTRACTION_FIELDS = [
  { label: 'W-2 Wages', value: '$85,000', confidence: 98 },
  { label: 'Employer', value: 'Acme Corp', confidence: 95 },
  { label: 'EIN', value: '12-3456789', confidence: 92 },
  { label: 'Federal Tax Withheld', value: '$12,750', confidence: 97 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
}

function getConfidenceColor(confidence) {
  if (confidence >= 90) return 'var(--color-secondary)' // highly confident (greenish)
  if (confidence >= 70) return 'var(--color-tertiary)' // medium (yellowish)
  return '#ffb4ab' // red
}

export default function AIExtractionCard({ fields = MOCK_EXTRACTION_FIELDS }) {
  return (
    <motion.div
      className="rounded-[20px] border border-[var(--color-primary)]/20 p-6 relative overflow-hidden"
      style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[var(--color-primary)]/10 rounded-full blur-[40px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

      {/* Header */}
      <motion.div className="mb-6 flex items-center gap-3 relative z-10" variants={itemVariants}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[12px] shadow-[0_0_15px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
        >
          <Sparkles size={16} className="text-[var(--color-primary)]" />
        </div>
        <span className="text-[14px] font-bold tracking-tight text-[var(--color-primary)]">
          Extracted by Sentinel AI
        </span>
      </motion.div>

      {/* Field rows */}
      <div className="space-y-4 relative z-10">
        {fields.map((field) => {
          const barColor = getConfidenceColor(field.confidence)
          return (
            <motion.div
              key={field.label}
              className="flex items-center justify-between gap-4 py-2"
              variants={itemVariants}
            >
              {/* Left: label + value */}
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-bold tracking-wide text-[var(--color-on-surface-variant)] uppercase">{field.label}</p>
                <p className="m-0 mt-1 truncate text-[15px] font-bold text-[var(--color-on-surface)]">{field.value}</p>
              </div>

              {/* Right: mini progress bar + percentage */}
              <div className="flex items-center gap-3">
                <div
                  className="h-1.5 w-20 overflow-hidden rounded-full relative bg-[var(--color-surface-container)]"
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${field.confidence}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                    style={{
                      background: barColor,
                      boxShadow: `0 0 8px color-mix(in srgb, ${barColor} 60%, transparent)`,
                    }}
                  />
                </div>
                <span
                  className="text-[12px] font-bold tabular-nums min-w-[36px] text-right"
                  style={{ color: barColor }}
                >
                  {field.confidence}%
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
