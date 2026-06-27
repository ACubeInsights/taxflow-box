import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, Image, File,
  Upload, Eye, Download, ClipboardCheck, ChevronRight,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { SectionHeader, GlassPanel, PanelTitle } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { vaultApi, documentApi } from '../../services/api'
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
  // Writer+: can edit (download to edit + re-upload)
  if (levelNum >= 3) actions.push({ key: 'edit', label: 'Edit', icon: Upload, color: 'var(--color-secondary)' })

  // Review action if metadata indicates it
  const needsReview = file.metadata?.status === 'pending_client_review' ||
    file.metadata?.status === 'Revision Requested' ||
    file.name?.toLowerCase().includes('review') ||
    file.metadata?.needsClientAction
  if (needsReview) actions.unshift({ key: 'review', label: 'Review', icon: ClipboardCheck, color: 'var(--color-tertiary)' })

  return actions
}

/* ─── File row component ─── */
function FileRow({ file, onAction, downloading }) {
  const actions = getFileActions(file)
  const modified = file.modified_at
    ? new Date(file.modified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      /* Elevated file card — matches GlassPanel inner-item styling */
      className="flex items-center gap-4 p-4 rounded-[16px] ring-1 ring-[var(--color-outline-variant)] bg-[var(--color-surface-container)] transition-all duration-300 group cursor-default hover:ring-[var(--color-outline)] hover:bg-[var(--color-surface-container)]/80"
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
          <button
            key={action.key}
            onClick={() => onAction(action.key, file)}
            disabled={action.key === 'download' && downloading === file.id}
            className="h-8 px-3 rounded-[10px] flex items-center gap-1.5 text-[11px] font-bold tracking-wide cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Folder section — collapsible with GlassPanel styling ─── */
function FolderSection({ folder, onAction, downloading }) {
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
        className="flex items-center gap-4 px-6 py-5 rounded-[20px] cursor-pointer transition-all duration-300 ring-1 group"
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
            className="h-9 px-4 rounded-[12px] flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
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
                <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] ring-1 ring-[#f87171]/20 bg-[#f87171]/5">
                  <AlertCircle size={14} className="text-[#f87171] shrink-0" />
                  <span className="text-[12px] text-[#f87171] font-medium flex-1">{error}</span>
                  <button onClick={fetchFiles} className="text-[11px] text-[#f87171] font-bold cursor-pointer bg-transparent border-none flex items-center gap-1 hover:underline">
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
                <FileRow key={file.id} file={file} onAction={onAction} downloading={downloading} />
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

/* ─── Main Client Dashboard ─── */
export default function ClientDashboard() {
  const { user } = useAuth() || {}
  const vault = user?.vault || null
  const [downloading, setDownloading] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [editUrl, setEditUrl] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const folders = getVaultFolders(vault)

  const handleAction = (action, file) => {
    if (action === 'view' || action === 'review') setPreviewFile(file)
    else if (action === 'download') handleDownload(file.id)
    else if (action === 'edit') handleEdit(file)
  }

  const handleDownload = async (fileId) => {
    setDownloading(fileId)
    try {
      const data = await vaultApi.getDownloadUrl(fileId)
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (err) { console.error('Download failed:', err.message) }
    finally { setDownloading(null) }
  }

  const handleEdit = async (file) => {
    setEditFile(file)
    setEditLoading(true)
    setEditUrl(null)
    try {
      const data = await documentApi.getEditUrl(file.id)
      if (data.embedUrl && data.method === 'editable_shared_link') {
        setEditUrl(data.embedUrl)
      } else if (data.embedUrl) {
        // Fallback to read-only preview
        setEditUrl(data.embedUrl)
      } else {
        // No embed available — download fallback
        handleDownload(file.id)
        setEditFile(null)
      }
    } catch (err) {
      console.error('Edit URL failed:', err.message)
      handleDownload(file.id)
      setEditFile(null)
    } finally {
      setEditLoading(false)
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

      {/* Edit Modal — Box editable shared link embed */}
      {editFile && (
        <AnimatePresence>
          <motion.div
            key="edit-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md"
            onClick={() => setEditFile(null)}
          />
          <motion.div
            key="edit-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-3 z-[201] flex flex-col rounded-[20px] overflow-hidden ring-1 ring-[var(--color-outline-variant)]"
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
                  <h3 className="m-0 text-[13px] font-bold text-[var(--color-on-surface)] truncate">{editFile.name}</h3>
                  <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)]">Editing in Box</p>
                </div>
              </div>
              <button
                onClick={() => setEditFile(null)}
                className="h-8 px-4 rounded-lg flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all ring-1 ring-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)]"
              >
                Done
              </button>
            </div>

            {/* Edit iframe */}
            <div className="flex-1 relative overflow-hidden bg-white">
              {editLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[var(--color-surface-lowest)]">
                  <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
                  <span className="text-[13px] text-[var(--color-on-surface-variant)] font-medium">Opening editor…</span>
                </div>
              )}
              {editUrl && (
                <iframe
                  src={editUrl}
                  title={`Edit: ${editFile.name}`}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  allow="fullscreen"
                />
              )}
              {!editLoading && !editUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface-lowest)]">
                  <AlertCircle size={28} className="text-[#f87171]" />
                  <p className="text-[13px] text-[var(--color-on-surface)] font-semibold m-0">Unable to open editor</p>
                  <p className="text-[11px] text-[var(--color-on-surface-variant)] m-0">Try downloading the file instead.</p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  )
}
