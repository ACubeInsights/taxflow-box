import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, Image, File,
  Upload, Eye, Download, ClipboardCheck, ChevronRight,
  Loader2, AlertCircle, RefreshCw, X, Check,
} from 'lucide-react'
import { SectionHeader, GlassPanel, PanelTitle } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { vaultApi, documentApi, getAuthToken } from '../../services/api'
import { formatFileSize, getFileIcon, sortFilesByDate } from '../../utils/fileUtils'
import UploadDropzone from '../UploadDropzone'
import BoxPreviewModal from '../BoxPreviewModal'

const ICON_MAP = { FileText, FileSpreadsheet, Image, File }

/* ─── Motion presets (matching site-wide stagger language) ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/* ─── Vault folder definitions ─── */
function getVaultFolders(vault) {
  if (!vault) return []
  // Show all vault folders — the API will return 404 for unauthorized ones
  // and the FolderSection component hides itself on access denied
  return [
    { key: 'uploads', id: vault.uploads, label: 'Uploads', access: 'upload' },
    { key: 'tax', id: vault.tax, label: 'Tax Returns', access: 'view' },
    { key: 'supportingDocs', id: vault.supportingDocs, label: 'Supporting Documents', access: 'view' },
    { key: 'signedDocuments', id: vault.signedDocuments, label: 'Signed Documents', access: 'view' },
  ].filter(f => f.id)
}

/* ─── File icon helper ─── */
function FileIconEl({ fileName, size = 16 }) {
  const iconName = getFileIcon(fileName)
  const IconComponent = ICON_MAP[iconName] || File
  return <IconComponent size={size} />
}

/* ─── Derive contextual actions per file based on access level ─── */
function getFileActions(file) {
  const actions = []
  const level = file.accessLevel || 'viewer'
  const levelNum = { no_access: 0, viewer: 1, commenter: 2, writer: 3, delete: 4 }[level] || 1

  // Viewer: only view (no download)
  if (levelNum >= 1) actions.push({ key: 'view', label: 'View', icon: Eye, color: 'var(--color-on-surface-variant)' })
  // Commenter+: can download
  if (levelNum >= 2) actions.push({ key: 'download', label: 'Download', icon: Download, color: 'var(--color-primary)' })
  // Writer+: can upload an updated version
  if (levelNum >= 3) actions.push({ key: 'update', label: 'Update', icon: Upload, color: 'var(--color-secondary)' })

  // Review action if metadata indicates it
  const needsReview = file.metadata?.status === 'pending_client_review' ||
    file.metadata?.status === 'Revision Requested' ||
    file.name?.toLowerCase().includes('review') ||
    file.metadata?.needsClientAction
  if (needsReview) actions.unshift({ key: 'review', label: 'Review', icon: ClipboardCheck, color: 'var(--color-tertiary)' })

  return actions
}

/* ─── File row component ─── */
function FileRow({ file, onAction, downloading, uploading }) {
  const actions = getFileActions(file)
  const modified = file.modified_at
    ? new Date(file.modified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const isUploading = uploading === file.id

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      /* Elevated file card — matches GlassPanel inner-item styling */
      className="flex items-center gap-4 p-4 rounded-xl ring-1 ring-[var(--color-outline-variant)] bg-[var(--color-surface-container)] transition-all duration-300 group cursor-default hover:ring-[var(--color-outline)] hover:bg-[var(--color-surface-container)]/80"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
    >
      {/* File icon with themed container — matches StatCard icon style */}
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 text-[var(--color-on-surface-variant)] transition-all duration-300 group-hover:scale-110"
        style={{
          background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
        }}
      >
        <FileIconEl fileName={file.name} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate leading-snug">
          {file.name}
        </p>
        <p className="m-0 mt-1 text-[11px] text-[var(--color-on-surface-variant)] font-medium">
          {formatFileSize(file.size || 0)}{modified && ` · ${modified}`}
        </p>
      </div>

      {/* Action buttons — appear on hover with smooth fade */}
      <div className="flex items-center gap-2 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
        {actions.map(action => (
          action.key === 'update' ? (
            <label
              key={action.key}
              className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-bold tracking-wide cursor-pointer transition-all duration-200 ${isUploading ? 'opacity-40 pointer-events-none' : ''}`}
              style={{
                background: `color-mix(in srgb, ${action.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${action.color} 22%, transparent)`,
                color: action.color,
              }}
              title="Upload updated version"
            >
              {isUploading
                ? <Loader2 size={12} className="animate-spin" />
                : <action.icon size={12} strokeWidth={2.5} />
              }
              <span className="hidden md:inline">{isUploading ? 'Uploading…' : action.label}</span>
              <input
                type="file"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => { onAction('update', file, e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
          ) : (
            <button
              key={action.key}
              onClick={() => onAction(action.key, file)}
              disabled={action.key === 'download' && downloading === file.id}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-bold tracking-wide cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `color-mix(in srgb, ${action.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${action.color} 22%, transparent)`,
                color: action.color,
              }}
              title={action.label}
            >
              {action.key === 'download' && downloading === file.id
                ? <Loader2 size={12} className="animate-spin" />
                : <action.icon size={12} strokeWidth={2.5} />
              }
              <span className="hidden md:inline">{action.label}</span>
            </button>
          )
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Folder section — collapsible with GlassPanel styling ─── */
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
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('does not belong') || msg.toLowerCase().includes('resource not found') || msg.toLowerCase().includes('not found')) {
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

  // Hide entirely if no read access
  if (accessDenied) return null

  // Hide empty folders (except upload-enabled ones which always show for the upload button)
  if (fetched && files.length === 0 && folder.access !== 'upload') return null

  return (
    <motion.div variants={itemVariants}>
      {/* Folder header bar — glass surface with hover glow */}
      <div
        onClick={handleToggle}
        className="flex items-center gap-4 px-6 py-5 rounded-xl cursor-pointer transition-all duration-300 ring-1 group"
        style={{
          background: open
            ? 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface-container))'
            : 'var(--color-surface-container)',
          boxShadow: open
            ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.35)'
            : '0 6px 20px rgba(0,0,0,0.25)',
          ringColor: open
            ? 'color-mix(in srgb, var(--color-primary) 20%, var(--color-outline-variant))'
            : 'var(--color-outline-variant)',
        }}
      >
        {/* Chevron with rotation */}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--color-on-surface-variant)]"
        >
          <ChevronRight size={14} />
        </motion.span>

        {/* Folder icon — themed container matching StatCard icon */}
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105"
          style={{
            background: open
              ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
              : 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            border: `1px solid color-mix(in srgb, var(--color-primary) ${open ? '30' : '18'}%, transparent)`,
          }}
        >
          {open
            ? <FolderOpen size={20} className="text-[var(--color-primary)]" />
            : <Folder size={20} className="text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-primary)] transition-colors duration-300" />
          }
        </div>

        {/* Folder name */}
        <span className="flex-1 text-[14px] font-bold text-[var(--color-on-surface)] tracking-tight">
          {folder.label}
        </span>

        {/* File count pill */}
        {fetched && files.length > 0 && (
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-wide"
            style={{
              background: 'color-mix(in srgb, var(--color-on-surface-variant) 10%, transparent)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            {files.length}
          </span>
        )}

        {/* Upload CTA — only on upload-enabled folders */}
        {folder.access === 'upload' && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(true); setShowUpload(true); }}
            className="h-9 px-4 rounded-xl flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface-lowest)',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)',
            }}
          >
            <Upload size={14} strokeWidth={2.5} /> Upload
          </button>
        )}
      </div>

      {/* Expanded file list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 pt-4 pb-2 pl-[60px] pr-2">
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
                  <span className="text-[12px] text-[var(--color-on-surface-variant)] font-medium">Loading…</span>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-muted)]">
                  <AlertCircle size={14} className="text-[var(--color-error)] shrink-0" />
                  <span className="text-[12px] text-[var(--color-error)] font-medium flex-1">{error}</span>
                  <button onClick={fetchFiles} className="text-[11px] text-[var(--color-error)] font-bold cursor-pointer bg-transparent border-none flex items-center gap-1 hover:underline">
                    <RefreshCw size={10} /> Retry
                  </button>
                </div>
              )}

              {/* Empty */}
              {!loading && !error && files.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10">
                  <div
                    className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-3 opacity-40"
                    style={{ background: 'color-mix(in srgb, var(--color-on-surface-variant) 8%, transparent)', border: '1px solid var(--color-outline-variant)' }}
                  >
                    <File size={20} className="text-[var(--color-on-surface-variant)]" />
                  </div>
                  <span className="text-[12px] text-[var(--color-on-surface-variant)] font-medium">No files yet</span>
                </div>
              )}

              {/* File rows */}
              {!loading && !error && files.map(file => (
                <FileRow key={file.id} file={file} onAction={onAction} downloading={downloading} uploading={uploading} />
              ))}

              {/* Inline upload dropzone */}
              {showUpload && folder.access === 'upload' && folder.id && (
                <div className="mt-3 mb-1">
                  <UploadDropzone folderId={folder.id} onUpload={() => { fetchFiles(); setShowUpload(false); }} disabled={false} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Edit Modal — Download + Re-upload flow for clients ─── */
function EditModal({ file, editUrl, editLoading, onClose, onDownload, onVersionUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const handleReupload = async (e) => {
    const newFile = e.target.files?.[0]
    if (!newFile) return

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', newFile)

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      const token = getAuthToken()
      const res = await fetch(`${API_BASE}/documents/${file.id}/upload-version`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed: HTTP ${res.status}`)
      }

      setUploaded(true)
      setTimeout(() => { onVersionUploaded() }, 1200)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="edit-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        key="edit-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-3 z-[201] flex flex-col rounded-2xl overflow-hidden ring-1 ring-[var(--color-outline-variant)]"
        style={{ background: 'var(--color-surface)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/60 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-tertiary)]/15 border border-[var(--color-tertiary)]/25">
              <FileText size={14} className="text-[var(--color-tertiary)]" />
            </div>
            <div className="min-w-0">
              <h3 className="m-0 text-[13px] font-bold text-[var(--color-on-surface)] truncate">{file.name}</h3>
              <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)]">Edit Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownload}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all ring-1 ring-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
            >
              <Download size={12} /> Download to Edit
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ring-1 ring-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content: Preview + Re-upload bar */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Preview iframe */}
          <div className="flex-1 relative bg-[var(--color-surface-lowest)]">
            {editLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[var(--color-surface-lowest)]">
                <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
                <span className="text-[13px] text-[var(--color-on-surface-variant)] font-medium">Loading document…</span>
              </div>
            )}
            {editUrl && (
              <iframe
                src={editUrl}
                title={`Edit: ${file.name}`}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                allow="fullscreen"
              />
            )}
            {!editLoading && !editUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface-lowest)]">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
                <p className="text-[13px] text-[var(--color-on-surface)] font-semibold m-0">Preview unavailable</p>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] m-0">Download the file to edit it.</p>
              </div>
            )}
          </div>

          {/* Re-upload bar at bottom */}
          <div className="shrink-0 px-6 py-4 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/80">
            {uploaded ? (
              <div className="flex items-center gap-3 justify-center">
                <Check size={18} className="text-[var(--color-success)]" />
                <span className="text-[13px] font-semibold text-[var(--color-success)]">Updated version uploaded successfully!</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface)]">
                    Done editing?
                  </p>
                  <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">
                    Upload your updated file to replace the current version.
                  </p>
                </div>
                <label className={`h-10 px-5 rounded-xl flex items-center gap-2 text-[13px] font-bold cursor-pointer transition-all shrink-0 ${
                  uploading
                    ? 'opacity-50 pointer-events-none bg-[var(--color-primary)]/15 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30'
                    : 'bg-[var(--color-primary)] text-[var(--color-surface-lowest)] hover:brightness-110 shadow-[0_2px_8px_rgba(129,140,248,0.25)]'
                }`}
                  style={!uploading ? { boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)' } : {}}
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : 'Upload Updated File'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleReupload}
                    disabled={uploading}
                  />
                </label>
              </div>
            )}
            {uploadError && (
              <p className="m-0 mt-2 text-[11px] text-[var(--color-error)] font-medium">{uploadError}</p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ─── Main Client Dashboard ─── */
export default function ClientDashboard() {
  const { user } = useAuth() || {}
  const vault = user?.vault || null
  const [downloading, setDownloading] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [uploading, setUploading] = useState(null) // fileId being updated

  const folders = getVaultFolders(vault)

  const handleAction = (action, file, selectedFile) => {
    if (action === 'view' || action === 'review') setPreviewFile(file)
    else if (action === 'download') handleDownload(file.id)
    else if (action === 'update' && selectedFile) handleUpdate(file, selectedFile)
  }

  const handleDownload = async (fileId) => {
    setDownloading(fileId)
    try {
      const data = await vaultApi.getDownloadUrl(fileId)
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (err) { console.error('Download failed:', err.message) }
    finally { setDownloading(null) }
  }

  const handleUpdate = async (file, selectedFile) => {
    setUploading(file.id)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      const token = getAuthToken()
      const res = await fetch(`${API_BASE}/documents/${file.id}/upload-version`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed: HTTP ${res.status}`)
      }

      // Refresh the page to show updated file
      window.location.reload()
    } catch (err) {
      console.error('Update failed:', err.message)
      // Surface the error without alert() — the FileRow will show it via downloading state reset
    } finally {
      setUploading(null)
    }
  }

  /* ─── Empty vault state ─── */
  if (!vault) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <SectionHeader title={`Welcome, ${user?.name || 'there'}`} subtitle="Your secure document vault is being configured." />
        <motion.div variants={itemVariants}>
          <GlassPanel>
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)' }}
              >
                <Folder size={28} className="text-[var(--color-primary)]" />
              </div>
              <p className="m-0 text-[15px] font-semibold text-[var(--color-on-surface)] mb-2">Setting up your vault</p>
              <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] max-w-[320px] text-center leading-relaxed">
                Your documents will appear here once your tax preparer finishes configuring your workspace.
              </p>
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    )
  }

  /* ─── Main view ─── */
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <SectionHeader
        title={`Welcome, ${user?.name || 'there'}`}
        subtitle={`Your ${vault.financialYear || new Date().getFullYear()} tax year documents`}
      />

      <div className="flex flex-col gap-3">
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

      {/* Box Content Preview Modal — replaces blob-fetch approach */}
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
    </motion.div>
  )
}
