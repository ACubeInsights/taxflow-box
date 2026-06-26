import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle, RefreshCw, Clock, FolderOpen, Activity,
  StickyNote, Send, ChevronRight, FolderPlus, Trash2, Pencil, ArrowLeft,
  File, FileText, Loader2, Check, X, Upload,
} from 'lucide-react'
import { GlassPanel, Badge, ProgressBar } from '../ui'
import Breadcrumb from '../Breadcrumb'
import { projectApi, portalApi, reviewApi, vaultApi, documentApi, clientApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'vault', label: 'Vault', icon: FolderOpen },
]

const STATUS_COLORS = {
  Active: '#22c55e',
  On_Hold: '#fbbf24',
  Complete: '#64748b',
}

export default function ClientDetailView() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const employeeId = user?.id || 'employee-1'
  const [client, setClient] = useState(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [clientError, setClientError] = useState(null)
  const [activeTab, setActiveTab] = useState('projects')

  const fetchClient = useCallback(async () => {
    setClientLoading(true)
    setClientError(null)
    try {
      // Fetch all clients
      let clients = []
      try {
        const data = await projectApi.getAllClients()
        clients = data.clients || data || []
      } catch { /* ignore */ }

      let found = clients.find((c) => c.id === clientId)

      if (!found) {
        setClientError('not_found')
      } else {
        setClient(found)
      }
    } catch (err) {
      setClientError(err.message || 'Failed to load client')
    } finally {
      setClientLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchClient() }, [fetchClient])

  if (clientLoading) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="h-4 w-48 rounded mb-6" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div className="h-8 w-64 rounded mb-4" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <GlassPanel>
          <div className="h-[300px] rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </GlassPanel>
      </div>
    )
  }

  if (clientError === 'not_found') {
    return (
      <div className="max-w-[1200px] mx-auto">
        <GlassPanel>
          <div className="py-12 text-center">
            <AlertTriangle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
            <p className="text-[#f87171] text-lg font-bold m-0 mb-2">Client not found</p>
            <p className="text-[var(--color-on-surface-variant)] text-sm m-0 mb-6">
              The client you are looking for does not exist or is not assigned to you.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold no-underline"
              style={{ background: 'rgba(173,198,255,0.15)', border: '1px solid rgba(173,198,255,0.25)', color: 'var(--color-primary)' }}
            >
              Back to Dashboard
            </Link>
          </div>
        </GlassPanel>
      </div>
    )
  }

  if (clientError) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <GlassPanel>
          <div className="py-8 text-center" style={{ background: 'rgba(248,113,113,0.05)', borderRadius: 16, border: '1px solid rgba(248,113,113,0.15)' }}>
            <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
            <p className="text-[#f87171] text-sm font-semibold m-0 mb-2">Failed to load client</p>
            <p className="text-[var(--color-on-surface-variant)] text-xs m-0 mb-4">{clientError}</p>
            <button
              onClick={fetchClient}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </GlassPanel>
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: client.name, path: `/clients/${clientId}` },
  ]
  const statusColor = STATUS_COLORS[client.engagementStatus] || '#6b7280'

  return (
    <div className="max-w-[1200px] mx-auto">
      <Breadcrumb segments={breadcrumbs} />
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0"
          style={{
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
            color: statusColor,
          }}
        >
          {(client.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <h1 className="m-0 text-[28px] font-bold tracking-tight text-[var(--color-on-surface)]">
            {client.name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge color={statusColor}>{(client.engagementStatus || '').replace('_', ' ')}</Badge>
            <span className="text-[12px] text-[var(--color-on-surface-variant)]">{client.entityType}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mb-6 border-b border-[var(--color-outline-variant)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-all duration-200 cursor-pointer bg-transparent ${
                isActive
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              <TabIcon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>
      {activeTab === 'projects' && <ProjectsTab clientId={clientId} navigate={navigate} />}
      {activeTab === 'vault' && <VaultTab client={client} />}
      {activeTab === 'activity' && <ActivityTab clientId={clientId} />}
      {activeTab === 'notes' && <NotesTab client={client} />}
    </div>
  )
}


/* ── Vault Tab (Folder Management) ── */
function VaultTab({ client }) {
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
  const [actionError, setActionError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)
  const [vaultMap, setVaultMap] = useState({}) // { folderId: label } — vault-mapped folders

  const currentFolderId = folderStack.length > 0
    ? folderStack[folderStack.length - 1].id
    : rootFolderId

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

  const handleDelete = async (folderId, folderName) => {
    if (!confirm(`Delete folder "${folderName}" and all its contents? This cannot be undone.`)) return
    setDeleting(folderId)
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border border-[var(--color-secondary,#22c55e)]/30 bg-[var(--color-secondary,#22c55e)]/10 text-[var(--color-secondary,#22c55e)] hover:bg-[var(--color-secondary,#22c55e)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[#f87171]/10 border border-[#f87171]/20">
          <AlertTriangle size={14} className="text-[#f87171] shrink-0" />
          <span className="text-[12px] text-[#f87171] font-medium flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[11px] text-[#f87171] font-bold cursor-pointer bg-transparent border-none">Dismiss</button>
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
          <AlertTriangle size={24} className="text-[#f87171] mx-auto mb-2" />
          <p className="text-[#f87171] text-xs font-semibold m-0 mb-2">{error}</p>
          <button onClick={() => fetchContents(currentFolderId)} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
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
              className="flex items-center gap-3 p-3 rounded-[14px] bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:ring-[var(--color-outline)] group"
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
                    onClick={() => navigateInto(folder)}
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
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
                    <button
                      onClick={() => handleDelete(folder.id, folder.name)}
                      disabled={deleting === folder.id}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[#f87171]/10 hover:border-[#f87171]/30 hover:text-[#f87171] disabled:opacity-40"
                      title="Delete"
                    >
                      {deleting === folder.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-[14px] bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)]"
            >
              <div className="w-9 h-9 rounded-[10px] bg-[var(--color-surface-container)] flex items-center justify-center border border-[var(--color-outline-variant)] shrink-0">
                <FileText size={18} className="text-[var(--color-on-surface-variant)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate">{file.name}</p>
                {file.size && <span className="text-[11px] text-[var(--color-on-surface-variant)]">{(file.size / 1024).toFixed(1)} KB</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  )
}


/* ── Projects Tab ── */
function ProjectsTab({ clientId, navigate }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await projectApi.getClientProjects(clientId)
      setProjects(data.projects || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  if (loading) {
    return (
      <GlassPanel>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[60px] rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </GlassPanel>
    )
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="py-6 text-center">
          <AlertTriangle size={24} color="#f87171" style={{ margin: '0 auto 8px' }} />
          <p className="text-[#f87171] text-xs font-semibold m-0 mb-2">Failed to load projects</p>
          <button onClick={fetchProjects} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </GlassPanel>
    )
  }

  if (projects.length === 0) {
    return (
      <GlassPanel>
        <p className="text-[var(--color-on-surface-variant)] text-sm m-0 py-6 text-center">No projects found for this client.</p>
      </GlassPanel>
    )
  }

  const PROJECT_COLORS = { Active: '#22c55e', On_Hold: '#fbbf24', Complete: '#64748b' }

  return (
    <GlassPanel>
      <div className="flex flex-col gap-3">
        {projects.map((project) => {
          const pColor = PROJECT_COLORS[project.status] || '#6b7280'
          return (
            <div
              key={project.id}
              onClick={() => navigate(`/clients/${clientId}/projects/${project.id}`)}
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] cursor-pointer transition-all duration-300 hover:bg-[var(--color-surface-highest)] hover:-translate-y-[1px] group"
            >
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{project.name}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 max-w-[200px]">
                    <ProgressBar value={project.progressPercentage ?? 0} color={pColor} />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-on-surface-variant)]">
                    {project.progressPercentage ?? 0}%
                  </span>
                  <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                    {project.documentCount ?? 0} docs
                  </span>
                </div>
              </div>
              <Badge color={pColor}>{(project.status || '').replace('_', ' ')}</Badge>
              <ChevronRight size={16} className="text-[var(--color-on-surface-variant)] opacity-40 group-hover:opacity-80 transition-opacity" />
            </div>
          )
        })}
      </div>
    </GlassPanel>
  )
}


/* ── Activity Tab ── */
function ActivityTab({ clientId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await portalApi.getEmployeeActivity(employeeId, 20)
      const all = data.activities || data || []
      setActivities(all.filter((a) => a.clientId === clientId))
    } catch (err) {
      setError(err.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  if (loading) {
    return (
      <GlassPanel>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[48px] rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </GlassPanel>
    )
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="py-6 text-center">
          <AlertTriangle size={24} color="#f87171" style={{ margin: '0 auto 8px' }} />
          <p className="text-[#f87171] text-xs font-semibold m-0 mb-2">Failed to load activity</p>
          <button onClick={fetchActivity} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </GlassPanel>
    )
  }

  if (activities.length === 0) {
    return (
      <GlassPanel>
        <p className="text-[var(--color-on-surface-variant)] text-sm m-0 py-6 text-center">No activity recorded for this client.</p>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel>
      <div className="relative pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[var(--color-outline-variant)]" />
        <div className="flex flex-col gap-4">
          {activities.map((entry) => (
            <div key={entry.id} className="relative flex items-start gap-4">
              <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-surface-container)] z-10" />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[13px] text-[var(--color-on-surface)]">
                  <span className="font-semibold">{entry.actorName}</span>{' '}
                  {entry.description}
                </p>
                <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] mt-0.5">
                  {entry.documentName && <span>{entry.documentName} · </span>}
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}


/* ── Notes Tab ── */
function NotesTab({ client }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const folderId = client.boxFolderId

  const fetchNotes = useCallback(async () => {
    if (!folderId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await reviewApi.listNotes(folderId)
      setNotes(data.notes || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!noteText.trim() || !folderId) return
    setSubmitting(true)
    try {
      const result = await reviewApi.createNote(folderId, 'Current Employee', 'Internal Note', noteText.trim())
      setNotes((prev) => [...prev, result.note || result])
      setNoteText('')
    } catch (err) {
      setError(err.message || 'Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <GlassPanel>
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-[60px] rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </GlassPanel>
    )
  }

  if (error && notes.length === 0) {
    return (
      <GlassPanel>
        <div className="py-6 text-center">
          <AlertTriangle size={24} color="#f87171" style={{ margin: '0 auto 8px' }} />
          <p className="text-[#f87171] text-xs font-semibold m-0 mb-2">Failed to load notes</p>
          <button onClick={fetchNotes} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel>
      {notes.length === 0 ? (
        <p className="text-[var(--color-on-surface-variant)] text-sm m-0 mb-6 text-center py-4">No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {notes.map((note, idx) => (
            <div key={note.id || idx} className="px-4 py-3 rounded-xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[12px] font-bold text-[var(--color-on-surface)]">{note.author || note.authorName || 'Unknown'}</span>
                <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                  {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                </span>
              </div>
              <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed">
                {note.content || note.body || note.text || ''}
              </p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an internal note..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-3 text-[13px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-all focus:border-[var(--color-primary)]"
        />
        <button
          type="submit"
          disabled={!noteText.trim() || submitting}
          className="self-end flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary)', color: 'var(--color-surface-lowest)' }}
        >
          <Send size={14} />
          {submitting ? 'Saving...' : 'Add Note'}
        </button>
      </form>
    </GlassPanel>
  )
}
