import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle, RefreshCw, FolderOpen,
  FolderPlus, Trash2, Pencil,
  File, FileText, Loader2, Check, X, Upload, Eye, Download, Edit3,
} from 'lucide-react'
import { FolioPanel as GlassPanel } from '../../ui'
import { vaultApi, documentApi } from '../../../services/api'
import DocumentEditor from '../../DocumentEditor'
import EmptyState from '../../EmptyState'


/* ── Vault Tab (Folder Management) ── */
export function VaultTab({ client }) {
  const rootFolderId = client?.boxFolderId
  const [folderStack, setFolderStack] = useState([]) // [{id, name}]
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [renaming, setRenaming] = useState(null) // folder id being renamed
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // { id, name }
  const [actionError, setActionError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)
  const [vaultMap, setVaultMap] = useState({}) // { folderId: label } — vault-mapped folders
  const [downloading, setDownloading] = useState(null)
  const [editorFile, setEditorFile] = useState(null) // { id, name, size } for DocumentEditor
  const { token } = useAuth() || {}

  const currentFolderId = folderStack.length > 0
    ? folderStack[folderStack.length - 1].id
    : rootFolderId

  const currentFolderIdRef = useRef(currentFolderId)
  currentFolderIdRef.current = currentFolderId

  const fetchContents = useCallback(async (folderId) => {
    if (!folderId) return
    setLoading(true)
    setError(null)
    try {
      const data = await vaultApi.listContents(folderId)
      setItems(data.items || [])
    } catch (err) {
      setError(err.message || 'Failed to load folder contents')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentFolderId) fetchContents(currentFolderId)
  }, [currentFolderId, fetchContents])

  const navigateInto = (folder) => {
    // Prevent navigating into the folder we're already viewing
    if (folder.id === currentFolderIdRef.current) return
    setFolderStack(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateBack = () => {
    setFolderStack(prev => prev.slice(0, -1))
  }

  const navigateTo = (index) => {
    setFolderStack(prev => prev.slice(0, index + 1))
  }

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim() || !currentFolderId) return
    setSubmitting(true)
    setActionError(null)
    try {
      await vaultApi.createFolder(currentFolderId, newFolderName.trim())
      setNewFolderName('')
      setCreating(false)
      fetchContents(currentFolderId)
    } catch (err) {
      setActionError(err.message || 'Failed to create folder')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRename = async (folderId) => {
    if (!renameValue.trim()) return
    setSubmitting(true)
    setActionError(null)
    try {
      await vaultApi.renameFolder(folderId, renameValue.trim())
      setRenaming(null)
      setRenameValue('')
      fetchContents(currentFolderId)
    } catch (err) {
      setActionError(err.message || 'Failed to rename folder')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (folderId) => {
    setDeleting(folderId)
    setPendingDelete(null)
    setActionError(null)
    try {
      await vaultApi.deleteFolder(folderId)
      fetchContents(currentFolderId)
    } catch (err) {
      setActionError(err.message || 'Failed to delete folder')
    } finally {
      setDeleting(null)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !currentFolderId) return
    setUploading(true)
    setUploadProgress(0)
    setActionError(null)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 8, 90))
    }, 150)
    try {
      await documentApi.upload(file, currentFolderId)
      clearInterval(progressInterval)
      setUploadProgress(100)
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        fetchContents(currentFolderId)
      }, 600)
    } catch (err) {
      clearInterval(progressInterval)
      setActionError(err.message || 'Upload failed')
      setUploading(false)
      setUploadProgress(0)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownload = async (fileId) => {
    setDownloading(fileId)
    try {
      const data = await vaultApi.getDownloadUrl(fileId)
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setActionError(err.message || 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  if (!rootFolderId) {
    return (
      <GlassPanel>
        <div className="py-12 text-center">
          <FolderOpen size={32} className="mx-auto mb-3 text-[var(--color-on-surface-variant)] opacity-50" />
          <p className="text-[var(--color-on-surface-variant)] text-sm m-0">
            No vault configured for this client.
          </p>
        </div>
      </GlassPanel>
    )
  }

  const folders = items.filter(i => i.type === 'folder')
  const files = items.filter(i => i.type === 'file')

  return (
    <>
    <GlassPanel>
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFolderStack([])}
          className={`text-[12px] font-semibold px-2 py-1 rounded-lg cursor-pointer transition-all border-none ${
            folderStack.length === 0
              ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
              : 'bg-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          }`}
        >
          Vault Root
        </button>
        {folderStack.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-2">
            <ChevronRight size={12} className="text-[var(--color-on-surface-variant)]" />
            <button
              onClick={() => navigateTo(idx)}
              className={`text-[12px] font-semibold px-2 py-1 rounded-lg cursor-pointer transition-all border-none ${
                idx === folderStack.length - 1
                  ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                  : 'bg-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-4">
        {folderStack.length > 0 && (
          <button
            onClick={navigateBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-all bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)]"
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}
        <button
          onClick={() => { setCreating(true); setActionError(null) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
        >
          <FolderPlus size={14} /> New Folder
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? `Uploading ${uploadProgress}%` : 'Upload File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="*/*"
        />
        <button
          onClick={() => fetchContents(currentFolderId)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-all bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* New folder form */}
      {creating && (
        <form onSubmit={handleCreateFolder} className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
          <FolderPlus size={18} className="text-[var(--color-primary)] shrink-0" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50"
          />
          <button
            type="submit"
            disabled={!newFolderName.trim() || submitting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-all border-none bg-[var(--color-primary)] text-[var(--color-surface-lowest)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Create
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setNewFolderName('') }}
            className="flex items-center px-2 py-1.5 rounded-lg text-[12px] cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
          >
            <X size={12} />
          </button>
        </form>
      )}

      {/* Action error */}
      {actionError && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[var(--color-error-muted)] border border-[var(--color-error)]/20">
          <AlertTriangle size={14} className="text-[var(--color-error)] shrink-0" />
          <span className="text-[12px] text-[var(--color-error)] font-medium flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[11px] text-[var(--color-error)] font-bold cursor-pointer bg-transparent border-none">Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)] mb-3" />
          <span className="text-[12px] text-[var(--color-on-surface-variant)] font-medium">Loading…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="py-8 text-center">
          <AlertTriangle size={24} className="text-[var(--color-error)] mx-auto mb-2" />
          <p className="text-[var(--color-error)] text-xs font-semibold m-0 mb-2">{error}</p>
          <button
            onClick={() => fetchContents(currentFolderId)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer bg-[var(--color-error-muted)] border border-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Contents */}
      {!loading && !error && (
        <div className="flex flex-col gap-2">
          {folders.length === 0 && files.length === 0 && (
            <div className="py-12 text-center">
              <FolderOpen size={28} className="text-[var(--color-on-surface-variant)] mx-auto mb-3 opacity-50" />
              <p className="text-[13px] text-[var(--color-on-surface-variant)] m-0">This folder is empty</p>
            </div>
          )}

          {/* Folders */}
          {folders.map(folder => (
            <div
              key={folder.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-outline)] group"
            >
              {renaming === folder.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <FolderOpen size={18} className="text-[var(--color-primary)] shrink-0" />
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(folder.id); if (e.key === 'Escape') setRenaming(null); }}
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-[var(--color-on-surface)]"
                  />
                  <button onClick={() => handleRename(folder.id)} disabled={submitting} className="px-2 py-1 rounded-md text-[11px] font-bold bg-[var(--color-primary)] text-[var(--color-surface-lowest)] border-none cursor-pointer disabled:opacity-40">
                    {submitting ? '...' : 'Save'}
                  </button>
                  <button onClick={() => setRenaming(null)} className="px-2 py-1 rounded-md text-[11px] bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer">Cancel</button>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => { if (!loading) navigateInto(folder) }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                      <FolderOpen size={18} className="text-[var(--color-primary)]" />
                    </div>
                    <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate">{folder.name}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setRenaming(folder.id); setRenameValue(folder.name) }}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[var(--color-tertiary)]/10 hover:text-[var(--color-tertiary)]"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    {pendingDelete?.id === folder.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(folder.id)}
                          disabled={deleting === folder.id}
                          className="h-7 px-2 rounded-md text-[10px] font-bold bg-[var(--color-error-muted)] border border-[var(--color-error)]/30 text-[var(--color-error)] cursor-pointer transition-all hover:bg-[var(--color-error)]/20 disabled:opacity-40"
                        >
                          {deleting === folder.id ? <Loader2 size={10} className="animate-spin" /> : 'Delete'}
                        </button>
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="h-7 px-2 rounded-md text-[10px] font-bold bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer hover:bg-[var(--color-surface-highest)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingDelete({ id: folder.id, name: folder.name })}
                        disabled={deleting === folder.id}
                        className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[var(--color-error-muted)] hover:border-[var(--color-error)]/30 hover:text-[var(--color-error)] disabled:opacity-40"
                        title="Delete"
                      >
                        {deleting === folder.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-outline)] group"
            >
              <div className="w-9 h-9 rounded-[10px] bg-[var(--color-surface-container)] flex items-center justify-center border border-[var(--color-outline-variant)] shrink-0">
                <FileText size={18} className="text-[var(--color-on-surface-variant)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate">{file.name}</p>
                {file.size && <span className="text-[11px] text-[var(--color-on-surface-variant)]">{(file.size / 1024).toFixed(1)} KB</span>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setEditorFile(file)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[var(--color-tertiary)]/10 hover:text-[var(--color-tertiary)]"
                  title="Preview & Edit"
                >
                  <Eye size={12} />
                </button>
                <button
                  onClick={() => handleDownload(file.id)}
                  disabled={downloading === file.id}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] disabled:opacity-40"
                  title="Download"
                >
                  {downloading === file.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>

      {/* Document Editor Modal — rendered outside GlassPanel to avoid overflow clipping */}
      {editorFile && (
        <DocumentEditor
          fileId={editorFile.id}
          fileName={editorFile.name}
          fileSize={editorFile.size || 0}
          sessionToken={token}
          onClose={() => setEditorFile(null)}
          onVersionUploaded={() => {
            setEditorFile(null)
            fetchContents(currentFolderId)
          }}
        />
      )}
    </>
  )
}


