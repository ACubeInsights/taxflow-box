import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

  // Fetch clients on open
  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const data = await projectApi.getAllClients()
        setClients(data.clients || data || [])
      } catch { setClients([]) }
    }
    load()
  }, [open])

  // Fetch folders when client selected
  useEffect(() => {
    if (!selectedClient?.boxFolderId) { setFolders([]); return }
    const load = async () => {
      setLoadingFolders(true)
      try {
        // Get root level
        const rootData = await vaultApi.listFiles(selectedClient.boxFolderId)
        const rootItems = rootData.files || []
        const rootFolders = rootItems.filter(f => f.type === 'folder')
        
        // Also get subfolders of each root folder (one level deep)
        const allFolders = [...rootFolders]
        for (const folder of rootFolders) {
          try {
            const subData = await vaultApi.listFiles(folder.id)
            const subFolders = (subData.files || []).filter(f => f.type === 'folder')
            for (const sub of subFolders) {
              allFolders.push({ ...sub, name: `${folder.name} / ${sub.name}` })
            }
          } catch { /* skip inaccessible subfolders */ }
        }
        setFolders(allFolders)
      } catch { setFolders([]) }
      finally { setLoadingFolders(false) }
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

      // Optionally set permission so client can see the file
      if (shareWithClient && uploadResult.file?.id) {
        await permissionApi.setPermission(
          selectedClient.id,
          uploadResult.file.id,
          'file',
          accessLevel,
          uploadResult.file.name
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
    setSelectedClient(null)
    setSelectedFolder(null)
    setFile(null)
    setShareWithClient(true)
    setAccessLevel('viewer')
    setResult(null)
    setError(null)
    setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-[500px] rounded-[20px] border border-[var(--color-outline-variant)] overflow-hidden"
          style={{ background: 'var(--color-surface-container)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]">
            <div>
              <h2 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)]">Share File with Client</h2>
              <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] mt-0.5">Upload a file to a client's vault</p>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {result ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="m-0 text-[15px] font-bold text-white mb-1">File Shared</h3>
                  <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)]">
                    {result.file?.name} uploaded to {selectedClient?.name}'s vault
                    {shareWithClient && ` (${accessLevel} access granted)`}
                  </p>
                </div>
                <button onClick={handleClose} className="mt-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-highest)] cursor-pointer">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Client picker */}
                <div>
                  <label className="text-[11px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wide mb-1.5 block">Client</label>
                  <select
                    value={selectedClient?.id || ''}
                    onChange={(e) => {
                      const c = clients.find(cl => cl.id === e.target.value)
                      setSelectedClient(c || null)
                      setSelectedFolder(null)
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[13px] text-[var(--color-on-surface)] outline-none cursor-pointer appearance-none"
                  >
                    <option value="">Select a client...</option>
                    {clients.filter(c => c.boxFolderId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Folder picker */}
                {selectedClient && (
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wide mb-1.5 block">Destination Folder</label>
                    {loadingFolders ? (
                      <div className="flex items-center gap-2 py-3 text-[12px] text-[var(--color-on-surface-variant)]">
                        <Loader2 size={14} className="animate-spin" /> Loading folders...
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                        {folders.map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setSelectedFolder(f)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] cursor-pointer border transition-colors ${
                              selectedFolder?.id === f.id
                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-on-surface)]'
                                : 'bg-transparent border-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]'
                            }`}
                          >
                            <Folder size={14} />
                            {f.name}
                          </button>
                        ))}
                        {folders.length === 0 && (
                          <p className="text-[12px] text-[var(--color-on-surface-variant)] italic py-2">No folders found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* File input */}
                {selectedFolder && (
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wide mb-1.5 block">File</label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-[12px] text-[var(--color-on-surface-variant)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-[var(--color-outline-variant)] file:text-[12px] file:font-semibold file:bg-[var(--color-surface-high)] file:text-[var(--color-on-surface)] file:cursor-pointer"
                    />
                  </div>
                )}

                {/* Share options */}
                {file && (
                  <div className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareWithClient}
                        onChange={(e) => setShareWithClient(e.target.checked)}
                        className="w-4 h-4 rounded accent-[var(--color-primary)]"
                      />
                      <span className="text-[12px] font-medium text-[var(--color-on-surface)]">
                        Share with client
                      </span>
                    </label>
                    {shareWithClient && (
                      <select
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[12px] text-[var(--color-on-surface)] outline-none cursor-pointer appearance-none"
                      >
                        <option value="viewer">Viewer (read only)</option>
                        <option value="commenter">Commenter</option>
                        <option value="writer">Writer (can edit)</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="m-0 text-[12px] text-red-300">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!selectedClient || !selectedFolder || !file || loading}
                  className="w-full py-3 rounded-xl text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none bg-white text-[#1a1a1a] hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload size={15} /> Upload & Share</>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
