import { useState } from 'react'
import {
  FileText, Calendar, ChevronRight, Upload, AlertTriangle, MessageSquare,
} from 'lucide-react'
import { FolioPanel, PanelTitle, StatusBadge, Badge, FolioRow } from './ui'
import UploadDropzone from './UploadDropzone'
import EmptyState from './EmptyState'

const PRIORITY_COLORS = {
  Low: 'var(--color-whisper)',
  low: 'var(--color-whisper)',
  Medium: 'var(--color-trace)',
  medium: 'var(--color-trace)',
  normal: 'var(--color-trace)',
  High: 'var(--color-flag)',
  high: 'var(--color-flag)',
  Urgent: 'var(--color-flag)',
  urgent: 'var(--color-flag)',
}

const ACTION_STATUSES = new Set(['Not_Requested', 'Revision_Requested'])

/**
 * Client-facing document request / progress list.
 */
export default function DocumentRequestList({
  requests = [],
  uploadsFolderId,
  onUploaded,
}) {
  const [expandedId, setExpandedId] = useState(null)

  const actionNeeded = requests.filter((r) => ACTION_STATUSES.has(r.status))
  const sorted = [...requests].sort((a, b) => {
    const aAction = ACTION_STATUSES.has(a.status) ? 0 : 1
    const bAction = ACTION_STATUSES.has(b.status) ? 0 : 1
    if (aAction !== bAction) return aAction - bAction
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
  })

  return (
    <FolioPanel className="mb-[var(--space-8)]">
      <div className="mb-[var(--space-4)] flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <PanelTitle>Your document requests</PanelTitle>
          {actionNeeded.length > 0 && (
            <Badge color="var(--color-flag)">{actionNeeded.length} need action</Badge>
          )}
        </div>
        <span className="text-xs text-[var(--color-whisper)]">
          {requests.length} total
        </span>
      </div>

      {actionNeeded.length > 0 && (
        <div
          className="mb-[var(--space-4)] flex items-start gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]"
          role="status"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-[var(--color-ink)]">
              Action needed on {actionNeeded.length} request{actionNeeded.length === 1 ? '' : 's'}
            </p>
            <p className="m-0 mt-[var(--space-1)] text-xs text-[var(--color-whisper)]">
              Upload missing documents or re-upload items marked revision requested.
            </p>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No requests yet"
          subtitle="When your preparer asks for documents, they will appear here."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[var(--space-2)] p-0">
          {sorted.map((req) => {
            const needsAction = ACTION_STATUSES.has(req.status)
            const isOpen = expandedId === req.id
            const revisionNote = req.revisionComments || req.reviewComments

            return (
              <li key={req.id}>
                <FolioRow
                  spineColor={needsAction ? 'var(--color-flag)' : 'var(--color-trace)'}
                  onClick={() => needsAction && setExpandedId(isOpen ? null : req.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)] text-[var(--color-whisper)]">
                    <FileText size={16} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">
                      {req.name}
                    </p>
                    <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)] text-xs text-[var(--color-whisper)]">
                      {req.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} aria-hidden />
                          Due {req.dueDate}
                        </span>
                      )}
                      {needsAction && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-flag)]">
                          <Upload size={12} aria-hidden />
                          {req.status === 'Revision_Requested' ? 'Re-upload needed' : 'Upload needed'}
                        </span>
                      )}
                    </div>
                    {req.status === 'Revision_Requested' && revisionNote && (
                      <p className="m-0 mt-[var(--space-2)] flex items-start gap-[var(--space-1)] text-xs text-[var(--color-flag)]">
                        <MessageSquare size={12} className="mt-0.5 shrink-0" aria-hidden />
                        <span>{revisionNote}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--space-2)]">
                    <Badge color={PRIORITY_COLORS[req.priority] || 'var(--color-whisper)'}>
                      {req.priority || 'normal'}
                    </Badge>
                    <StatusBadge status={req.status} />
                    {needsAction && (
                      <ChevronRight
                        size={14}
                        className="text-[var(--color-whisper)]"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                        aria-hidden
                      />
                    )}
                  </div>
                </FolioRow>

                {isOpen && needsAction && uploadsFolderId && (
                  <div className="mt-[var(--space-2)] pl-0 sm:pl-[var(--space-8)]">
                    <UploadDropzone
                      folderId={uploadsFolderId}
                      requestId={req.id}
                      onUpload={() => {
                        setExpandedId(null)
                        onUploaded?.(req.id)
                      }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FolioPanel>
  )
}
