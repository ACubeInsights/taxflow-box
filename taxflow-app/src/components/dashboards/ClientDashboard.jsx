import { useState, useEffect, useCallback } from 'react'
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, Image, File,
  Upload, Eye, Download, ChevronRight,
  Loader2, AlertCircle, RefreshCw, X,
} from 'lucide-react'
import { SectionHeader, FolioPanel, FolioSpine } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { vaultApi, portalApi, getAuthToken } from '../../services/api'
import { formatFileSize, getFileIcon, sortFilesByDate } from '../../utils/fileUtils'
import UploadDropzone from '../UploadDropzone'
import BoxPreviewModal from '../BoxPreviewModal'
import DocumentRequestList from '../DocumentRequestList'

const ICON_MAP = { FileText, FileSpreadsheet, Image, File }

function getVaultFolders(vault) {
  if (!vault) return []
  return [
    { key: 'uploads', id: vault.uploads, label: 'Your uploads', access: 'upload' },
    { key: 'tax', id: vault.tax, label: 'Tax returns', access: 'view' },
    { key: 'supportingDocs', id: vault.supportingDocs, label: 'Supporting documents', access: 'view' },
    { key: 'signedDocuments', id: vault.signedDocuments, label: 'Signed documents', access: 'view' },
  ].filter(f => f.id)
}

function FileIconEl({ fileName, size = 16 }) {
  const IconComponent = ICON_MAP[getFileIcon(fileName)] || File
  return <IconComponent size={size} aria-hidden />
}

function getFileActions(file) {
  const actions = []
  const level = file.accessLevel || 'viewer'
  const levelNum = { no_access: 0, viewer: 1, commenter: 2, writer: 3, delete: 4 }[level] || 1

  if (levelNum >= 1) actions.push({ key: 'view', label: 'View file', icon: Eye })
  if (levelNum >= 2) actions.push({ key: 'download', label: 'Download', icon: Download })
  if (levelNum >= 3) actions.push({ key: 'update', label: 'Replace file', icon: Upload })
  return actions
}

function FileRow({ file, onAction, downloading, uploading }) {
  const actions = getFileActions(file)
  const modified = file.modified_at
    ? new Date(file.modified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const isUploading = uploading === file.id

  return (
    <div className="flex items-stretch gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)]">
      <FolioSpine color="var(--color-trace)" className="rounded-l-[var(--radius-panel)] rounded-r-none" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[var(--space-3)] py-[var(--space-3)] pr-[var(--space-3)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)] text-[var(--color-whisper)]">
          <FileIconEl fileName={file.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">{file.name}</p>
          <p className="mono-sm m-0 mt-[var(--space-1)] text-[var(--color-whisper)]">
            {formatFileSize(file.size || 0)}{modified && ` · ${modified}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          {actions.map(action => (
            action.key === 'update' ? (
              <label
                key={action.key}
                className={`btn-ghost h-8 cursor-pointer px-[var(--space-3)] text-xs ${isUploading ? 'pointer-events-none opacity-40' : ''}`}
              >
                {isUploading
                  ? <Loader2 size={12} className="animate-spin" aria-hidden />
                  : <action.icon size={12} strokeWidth={2.5} aria-hidden />
                }
                <span>{isUploading ? 'Replacing…' : action.label}</span>
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploading}
                  aria-label={`Replace ${file.name}`}
                  onChange={(e) => { onAction('update', file, e.target.files?.[0]); e.target.value = '' }}
                />
              </label>
            ) : (
              <button
                key={action.key}
                type="button"
                onClick={() => onAction(action.key, file)}
                disabled={action.key === 'download' && downloading === file.id}
                className="btn-ghost h-8 px-[var(--space-3)] text-xs"
                aria-label={`${action.label}: ${file.name}`}
              >
                {action.key === 'download' && downloading === file.id
                  ? <Loader2 size={12} className="animate-spin" aria-hidden />
                  : <action.icon size={12} strokeWidth={2.5} aria-hidden />
                }
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            )
          ))}
        </div>
      </div>
    </div>
  )
}

function FolderSection({ folder, onAction, downloading, uploading }) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!folder.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await vaultApi.listFiles(folder.id)
      setFiles(sortFilesByDate(data.files || []))
      setFetched(true)
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.toLowerCase().includes('access denied') ||
        msg.toLowerCase().includes('does not belong') ||
        msg.toLowerCase().includes('resource not found') ||
        msg.toLowerCase().includes('not found')
      ) {
        setAccessDenied(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [folder.id])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !fetched && !loading) fetchFiles()
  }

  if (accessDenied) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)] px-[var(--space-6)] py-[var(--space-4)]">
        <p className="m-0 text-sm text-[var(--color-whisper)]">
          <span className="font-medium text-[var(--color-ink)]">{folder.label}</span>
          {' — '}you do not have access to this folder.
        </p>
      </div>
    )
  }

  if (fetched && files.length === 0 && folder.access !== 'upload') return null

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)] px-[var(--space-4)] py-[var(--space-4)] sm:px-[var(--space-6)]"
        style={open ? { borderColor: 'var(--color-trace)' } : undefined}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-[var(--space-3)] border-none bg-transparent p-0 text-left"
          aria-expanded={open}
        >
          <ChevronRight
            size={14}
            className="shrink-0 text-[var(--color-whisper)]"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
            aria-hidden
          />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
            {open
              ? <FolderOpen size={18} className="text-[var(--color-trace)]" aria-hidden />
              : <Folder size={18} className="text-[var(--color-whisper)]" aria-hidden />
            }
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
            {folder.label}
          </span>
          {fetched && files.length > 0 && (
            <span className="mono-sm rounded-[var(--radius-chip)] bg-[var(--color-ledger)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--color-whisper)]">
              {files.length}
            </span>
          )}
        </button>

        {folder.access === 'upload' && (
          <button
            type="button"
            onClick={() => { setOpen(true); setShowUpload(true) }}
            className="btn-signal h-9 px-[var(--space-4)] text-xs"
          >
            <Upload size={14} strokeWidth={2.5} aria-hidden />
            Upload file
          </button>
        )}
      </div>

      {open && (
        <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)] pl-0 sm:pl-[var(--space-8)]">
          {loading && (
            <div className="flex items-center justify-center gap-[var(--space-2)] py-[var(--space-10)]">
              <Loader2 size={18} className="animate-spin text-[var(--color-signal)]" aria-hidden />
              <span className="text-sm text-[var(--color-whisper)]">Loading files…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]">
              <AlertCircle size={14} className="shrink-0 text-[var(--color-flag)]" aria-hidden />
              <span className="flex-1 text-sm text-[var(--color-flag)]">{error}</span>
              <button type="button" onClick={fetchFiles} className="btn-ghost h-8 text-xs">
                <RefreshCw size={12} aria-hidden /> Retry
              </button>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <p className="m-0 py-[var(--space-8)] text-center text-sm text-[var(--color-whisper)]">
              No files in this folder yet
            </p>
          )}

          {!loading && !error && files.map(file => (
            <FileRow
              key={file.id}
              file={file}
              onAction={onAction}
              downloading={downloading}
              uploading={uploading}
            />
          ))}

          {showUpload && folder.access === 'upload' && folder.id && (
            <div className="mt-[var(--space-2)]">
              <UploadDropzone
                folderId={folder.id}
                onUpload={() => { fetchFiles(); setShowUpload(false) }}
                disabled={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientDashboard() {
  const { user } = useAuth() || {}
  const vault = user?.vault || null
  const clientId = vault?.clientId || user?.clientId || null
  const [downloading, setDownloading] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [updateError, setUpdateError] = useState(null)
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestsError, setRequestsError] = useState(null)

  const folders = getVaultFolders(vault)
  const year = vault?.financialYear || new Date().getFullYear()

  const fetchRequests = useCallback(async () => {
    if (!clientId) return
    setRequestsLoading(true)
    setRequestsError(null)
    try {
      const data = await portalApi.getClientProgress(clientId)
      setRequests(data.documents || [])
    } catch (err) {
      setRequestsError(err.message || 'Could not load document requests')
    } finally {
      setRequestsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleDownload = async (fileId) => {
    setDownloading(fileId)
    try {
      const data = await vaultApi.getDownloadUrl(fileId)
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setUpdateError(err.message || 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const handleUpdate = async (file, selectedFile) => {
    setUploading(file.id)
    setUpdateError(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      const token = getAuthToken()
      const res = await fetch(`${API_BASE}/documents/${file.id}/upload-version`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Replace failed: HTTP ${res.status}`)
      }
      window.location.reload()
    } catch (err) {
      setUpdateError(err.message || 'Could not replace file')
    } finally {
      setUploading(null)
    }
  }

  const handleAction = (action, file, selectedFile) => {
    if (action === 'view') setPreviewFile(file)
    else if (action === 'download') handleDownload(file.id)
    else if (action === 'update' && selectedFile) handleUpdate(file, selectedFile)
  }

  if (!vault) {
    return (
      <div className="mx-auto w-full max-w-[var(--layout-content-max)]">
        <SectionHeader
          title={`Welcome, ${user?.name || 'there'}`}
          subtitle="Your preparer is still setting up your vault."
        />
        <FolioPanel>
          <div className="flex flex-col items-center py-[var(--space-12)] text-center">
            <div className="mb-[var(--space-4)] flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
              <Folder size={24} className="text-[var(--color-trace)]" aria-hidden />
            </div>
            <p className="m-0 mb-[var(--space-2)] text-base font-medium text-[var(--color-ink)]">
              Vault not ready yet
            </p>
            <p className="m-0 max-w-[320px] text-sm leading-relaxed text-[var(--color-whisper)]">
              Documents will appear here once your tax preparer finishes configuring your workspace.
            </p>
          </div>
        </FolioPanel>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[var(--layout-content-max)]">
      <SectionHeader
        title={`Welcome, ${user?.name || 'there'}`}
        subtitle={`Your ${year} tax-year documents`}
      />

      {updateError && (
        <div
          className="mb-[var(--space-4)] flex items-start gap-[var(--space-2)] rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]"
          role="alert"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
          <p className="m-0 flex-1 text-sm text-[var(--color-flag)]">{updateError}</p>
          <button
            type="button"
            onClick={() => setUpdateError(null)}
            className="border-none bg-transparent p-0 text-[var(--color-flag)] cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {clientId && (
        <>
          {requestsLoading && (
            <FolioPanel className="mb-[var(--space-8)]">
              <div className="flex items-center justify-center gap-[var(--space-2)] py-[var(--space-8)]">
                <Loader2 size={18} className="animate-spin text-[var(--color-signal)]" aria-hidden />
                <span className="text-sm text-[var(--color-whisper)]">Loading requests…</span>
              </div>
            </FolioPanel>
          )}
          {!requestsLoading && requestsError && (
            <div className="mb-[var(--space-8)] flex items-center gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]">
              <AlertCircle size={14} className="shrink-0 text-[var(--color-flag)]" aria-hidden />
              <span className="flex-1 text-sm text-[var(--color-flag)]">{requestsError}</span>
              <button type="button" onClick={fetchRequests} className="btn-ghost h-8 text-xs">
                <RefreshCw size={12} aria-hidden /> Retry
              </button>
            </div>
          )}
          {!requestsLoading && !requestsError && (
            <DocumentRequestList
              requests={requests}
              uploadsFolderId={vault?.uploads}
              onUploaded={fetchRequests}
            />
          )}
        </>
      )}

      <div className="flex flex-col gap-[var(--space-3)]">
        {folders.map(folder => (
          <FolderSection
            key={folder.key}
            folder={folder}
            onAction={handleAction}
            downloading={downloading}
            uploading={uploading}
          />
        ))}
      </div>

      {previewFile && (
        <BoxPreviewModal
          fileId={previewFile.id}
          fileName={previewFile.name}
          fileSize={previewFile.size || 0}
          userId={user?.id || user?.boxUserId || ''}
          canDownload={({ no_access: 0, viewer: 1, commenter: 2, writer: 3, delete: 4 }[previewFile.accessLevel || 'viewer'] || 1) >= 2}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownload(previewFile.id)}
        />
      )}
    </div>
  )
}
