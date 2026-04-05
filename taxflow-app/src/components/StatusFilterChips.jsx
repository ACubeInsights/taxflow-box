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
    <div className="flex flex-wrap gap-2">
      {ALL_STATUSES.map((status) => {
        const isSelected = selected.includes(status)
        const color = STATUS_COLORS[status]

        return (
          <button
            key={status}
            onClick={() => toggle(status)}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 cursor-pointer border"
            style={
              isSelected
                ? {
                    background: color,
                    borderColor: color,
                    color: '#fff',
                    boxShadow: `0 0 12px ${color}40`,
                  }
                : {
                    background: 'transparent',
                    borderColor: `${color}50`,
                    color: color,
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
