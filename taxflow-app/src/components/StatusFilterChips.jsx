import { DocumentStatus, STATUS_COLORS } from '../context/DocumentWorkflowContext'

const STATUS_LABELS = {
  [DocumentStatus.Not_Requested]: 'Not Requested',
  [DocumentStatus.Uploaded]: 'Uploaded',
  [DocumentStatus.Under_Review]: 'Under Review',
  [DocumentStatus.Revision_Requested]: 'Revision Requested',
  [DocumentStatus.Approved]: 'Approved',
  [DocumentStatus.Waived]: 'Waived',
}

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
