import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

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
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function getConfidenceColor(confidence) {
  if (confidence >= 90) return '#06b6d4' // cyan for high
  if (confidence >= 70) return '#eab308' // yellow for medium
  return '#ef4444' // red for low
}

export default function AIExtractionCard({ fields = MOCK_EXTRACTION_FIELDS }) {
  return (
    <motion.div
      className="rounded-xl border border-purple-500/20 p-5"
      style={{ background: 'rgba(167,139,250,0.05)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="mb-4 flex items-center gap-3" variants={itemVariants}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}
        >
          <Bot size={16} color="#a78bfa" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-purple-300">
          Extracted by Box AI
        </span>
      </motion.div>

      {/* Field rows */}
      <div className="space-y-3">
        {fields.map((field) => {
          const barColor = getConfidenceColor(field.confidence)
          return (
            <motion.div
              key={field.label}
              className="flex items-center justify-between gap-4"
              variants={itemVariants}
            >
              {/* Left: label + value */}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-white/40">{field.label}</p>
                <p className="truncate text-sm font-bold text-white">{field.value}</p>
              </div>

              {/* Right: mini progress bar + percentage */}
              <div className="flex items-center gap-2">
                <div
                  className="h-[3px] w-16 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${field.confidence}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    style={{
                      background: barColor,
                      boxShadow: `0 0 6px ${barColor}60`,
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums"
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
