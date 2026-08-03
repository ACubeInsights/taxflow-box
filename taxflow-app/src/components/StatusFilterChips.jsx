import { DocumentStatus } from '../constants/statusTransitions.js'
import { STATUS_COLORS, STATUS_LABELS } from '../constants/statusColors'

const ALL_STATUSES = Object.values(DocumentStatus)

export default function StatusFilterChips({ selected = [], onChange }) {
  const toggle = (status) => {
    const next = selected.includes(status)
      ? selected.filter((s) => s !== status)
      : [...selected, status]
    onChange(next)
  }

  return (
    <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Filter by status">
      {ALL_STATUSES.map((status) => {
        const isSelected = selected.includes(status)
        const color = STATUS_COLORS[status]

        return (
          <button
            key={status}
            type="button"
            onClick={() => toggle(status)}
            aria-pressed={isSelected}
            className="cursor-pointer rounded-[var(--radius-chip)] border px-[var(--space-3)] py-[var(--space-2)] text-xs font-medium tracking-[0.04em]"
            style={
              isSelected
                ? {
                    background: color,
                    borderColor: color,
                    color: 'var(--color-archive)',
                  }
                : {
                    background: 'transparent',
                    borderColor: 'var(--color-rule)',
                    color: 'var(--color-whisper)',
                  }
            }
          >
            {STATUS_LABELS[status]}
          </button>
        )
      })}
    </div>
  )
}
