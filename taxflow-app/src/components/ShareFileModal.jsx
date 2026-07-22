import { useState, useEffect } from 'react'
import { X, Upload, Folder, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { projectApi, vaultApi, documentApi, permissionApi } from '../services/api'

export default function ShareFileModal({ open, onClose }) {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [file, setFile] = useState(null)
  const [shareWithClient, setShareWithClient] = useState(true)
  const [accessLevel, setAccessLevel] = useState('viewer')
  const [loading, setLoading] = useState(false)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    projectApi.getAllClients()
      .then(data => setClients(data.clients || data || []))
      .catch(() => setClients([]))
  }, [open])

  useEffect(() => {
    if (!selectedClient?.boxFolderId) { setFolders([]); return }
    setLoadingFolders(true)
    const load = async () => {
      try {
        const rootData = await vaultApi.listFiles(selectedClient.boxFolderId)
        const rootFolders = (rootData.files || []).filter(f => f.type === 'folder')
        const allFolders = [...rootFolders]
        for (const folder of rootFolders) {
          try {
            const subData = await vaultApi.listFiles(folder.id)
            const subs = (subData.files || []).filter(f => f.type === 'folder')
            subs.forEach(sub => allFolders.push({ ...sub, name: `${folder.name} / ${sub.name}` }))
          } catch { /* skip */ }
        }
        setFolders(allFolders)
      } catch {
        setFolders([])
      } finally {
        setLoadingFolders(false)
      }
    }
    load()
  }, [selectedClient])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClient || !selectedFolder || !file) return
    setLoading(true)
    setError(null)
    try {
      const uploadResult = await documentApi.upload(file, selectedFolder.id)
      if (shareWithClient && uploadResult.file?.id) {
        await permissionApi.setPermission(
          selectedClient.id, uploadResult.file.id, 'file', accessLevel, uploadResult.file.name,
        )
      }
      setResult(uploadResult)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedClient(null); setSelectedFolder(null); setFile(null)
    setShareWithClient(true); setAccessLevel('viewer')
    setResult(null); setError(null); setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-[var(--space-4)]"
      style={{ background: 'color-mix(in srgb, var(--color-archive) 72%, transparent)' }}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-file-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-[var(--space-6)] py-[var(--space-4)]">
          <div>
            <h2 id="share-file-title" className="m-0 font-display text-md font-semibold text-[var(--color-ink)]">
              Share a file
            </h2>
            <p className="m-0 mt-[var(--space-1)] text-sm text-[var(--color-whisper)]">
              Upload into a client’s vault folder
            </p>
          </div>
          <button type="button" onClick={handleClose} className="btn-ghost h-8 w-8 p-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-[var(--space-6)] py-[var(--space-5)]">
          {result ? (
            <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-4)] text-center">
              <CheckCircle2 size={28} className="text-[var(--color-commit)]" aria-hidden />
              <div>
                <h3 className="m-0 mb-[var(--space-1)] font-display text-md font-semibold text-[var(--color-ink)]">
                  File shared
                </h3>
                <p className="m-0 text-sm text-[var(--color-whisper)]">
                  {result.file?.name} uploaded to {selectedClient?.name}’s vault
                  {shareWithClient && ` (${accessLevel} access)`}
                </p>
              </div>
              <button type="button" onClick={handleClose} className="btn-ghost">Done</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
              <div>
                <label className="label-caps mb-[var(--space-2)] block" htmlFor="share-client">Client</label>
                <select
                  id="share-client"
                  value={selectedClient?.id || ''}
                  onChange={(e) => {
                    const c = clients.find(cl => cl.id === e.target.value)
                    setSelectedClient(c || null)
                    setSelectedFolder(null)
                  }}
                  className="folio-select"
                >
                  <option value="">Select a client…</option>
                  {clients.filter(c => c.boxFolderId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div>
                  <p className="label-caps mb-[var(--space-2)]">Destination folder</p>
                  {loadingFolders ? (
                    <div className="flex items-center gap-[var(--space-2)] py-[var(--space-3)] text-sm text-[var(--color-whisper)]">
                      <Loader2 size={14} className="animate-spin" aria-hidden /> Loading folders…
                    </div>
                  ) : (
                    <div className="flex max-h-[140px] flex-col gap-[var(--space-1)] overflow-y-auto">
                      {folders.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFolder(f)}
                          className={`flex cursor-pointer items-center gap-[var(--space-2)] rounded-[var(--radius-control)] border px-[var(--space-3)] py-[var(--space-2)] text-left text-sm ${
                            selectedFolder?.id === f.id
                              ? 'border-[var(--color-signal)] bg-[var(--color-signal-muted)] text-[var(--color-ink)]'
                              : 'border-transparent bg-transparent text-[var(--color-whisper)] hover:bg-[var(--color-ledger)]'
                          }`}
                        >
                          <Folder size={14} aria-hidden />
                          {f.name}
                        </button>
                      ))}
                      {folders.length === 0 && (
                        <p className="m-0 py-[var(--space-2)] text-sm italic text-[var(--color-whisper)]">No folders found</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedFolder && (
                <div>
                  <label className="label-caps mb-[var(--space-2)] block" htmlFor="share-file-input">File</label>
                  <input
                    id="share-file-input"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-[var(--color-whisper)] file:mr-[var(--space-3)] file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-[var(--color-rule)] file:bg-[var(--color-ledger)] file:px-[var(--space-4)] file:py-[var(--space-2)] file:text-sm file:font-medium file:text-[var(--color-ink)]"
                  />
                </div>
              )}

              {file && (
                <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)] p-[var(--space-3)]">
                  <label className="flex cursor-pointer items-center gap-[var(--space-2)]">
                    <input
                      type="checkbox"
                      checked={shareWithClient}
                      onChange={(e) => setShareWithClient(e.target.checked)}
                      className="h-4 w-4 accent-[var(--color-signal)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-ink)]">Grant client access</span>
                  </label>
                  {shareWithClient && (
                    <select
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                      className="folio-select"
                      aria-label="Access level"
                    >
                      <option value="viewer">Viewer (read only)</option>
                      <option value="commenter">Commenter</option>
                      <option value="writer">Writer (can edit)</option>
                    </select>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-3)]" role="alert">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
                  <p className="m-0 text-sm text-[var(--color-flag)]">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedClient || !selectedFolder || !file || loading}
                className="btn-signal w-full"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Uploading…</>
                  : <><Upload size={15} aria-hidden /> Upload & share</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
