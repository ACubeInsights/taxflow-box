import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Eye, Edit3, History, Upload, Download, X, Loader2, 
  AlertCircle, RefreshCw, FileText, Check, ChevronDown 
} from 'lucide-react'
import { formatFileSize } from '../utils/fileUtils'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * DocumentEditor — Embedded document editing with three modes:
 * 
 * 1. PREVIEW: Box Content Preview with annotations (highlight, comment, draw)
 * 2. EDIT: Box Embed iframe with "Open" button (ONLYOFFICE / Office Online)
 * 3. VERSIONS: Version history with download for each version
 * 
 * Uses downscoped tokens for preview and shared links for editing.
 * No Box login needed — works with App User tokens via the Service Account.
 */
export default function DocumentEditor({ 
  fileId, 
  fileName, 
  fileSize,
  onClose, 
  onVersionUploaded,
  sessionToken,
}) {
  const [mode, setMode] = useState('preview') // 'preview' | 'edit' | 'versions'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Preview state
  const [previewToken, setPreviewToken] = useState(null)
  const previewContainerRef = useRef(null)
  const previewInstanceRef = useRef(null)
  
  // Edit state
  const [embedUrl, setEmbedUrl] = useState(null)
  
  // Version state
  const [versions, setVersions] = useState([])
  
  // Upload state
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const authHeaders = {
    'Authorization': `Bearer ${sessionToken}`,
  }

  // ─── FETCH PREVIEW TOKEN ───────────────────────────────────────────
  const fetchPreviewToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/documents/${fileId}/preview-token`, {
        headers: authHeaders,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setPreviewToken(data.accessToken)
    } catch (err) {
      setError(`Preview: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fileId, sessionToken])

  // ─── FETCH EDIT URL ────────────────────────────────────────────────
  const fetchEditUrl = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/documents/${fileId}/edit-url`, {
        headers: authHeaders,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setEmbedUrl(data.embedUrl)
    } catch (err) {
      setError(`Edit: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fileId, sessionToken])

  // ─── FETCH VERSIONS ────────────────────────────────────────────────
  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/portal/files/${fileId}/versions`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setVersions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(`Versions: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fileId, sessionToken])

  // ─── MODE SWITCHING ────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'preview') fetchPreviewToken()
    else if (mode === 'edit') fetchEditUrl()
    else if (mode === 'versions') fetchVersions()
  }, [mode])

  // ─── INITIALIZE BOX PREVIEW ────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'preview' || !previewToken || !previewContainerRef.current) return

    // Check if Box Preview SDK is loaded (from CDN)
    if (typeof Box !== 'undefined' && Box.Preview) {
      const preview = new Box.Preview()
      preview.show(fileId, previewToken, {
        container: previewContainerRef.current,
        showAnnotations: true,
        showDownload: true,
        header: 'light',
      })
      previewInstanceRef.current = preview
      setLoading(false)
    } else {
      // Fallback: use expiring embed link approach (already proven to work)
      setLoading(false)
    }

    return () => {
      if (previewInstanceRef.current) {
        try { previewInstanceRef.current.hide() } catch {}
        previewInstanceRef.current = null
      }
    }
  }, [previewToken, mode, fileId])

  // ─── UPLOAD NEW VERSION ────────────────────────────────────────────
  const handleUploadVersion = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/api/documents/${fileId}/upload-version`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed: HTTP ${res.status}`)
      }
      
      // Success — refresh versions
      if (mode === 'versions') fetchVersions()
      if (onVersionUploaded) onVersionUploaded()
    } catch (err) {
      setError(`Upload: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── DOWNLOAD ──────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vaults/files/${fileId}/download`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Download failed')
      const data = await res.json()
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank')
      }
    } catch (err) {
      setError(`Download: ${err.message}`)
    }
  }

  // ─── ESCAPE KEY ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ─── RENDER ────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-4 z-[201] flex flex-col rounded-2xl overflow-hidden ring-1 ring-[var(--color-outline-variant)]"
        style={{ background: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/60 shrink-0">
          {/* File info */}
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <h3 className="m-0 text-sm font-bold text-[var(--color-on-surface)] truncate">{fileName}</h3>
              {fileSize > 0 && <p className="m-0 text-xs text-[var(--color-on-surface-variant)]">{formatFileSize(fileSize)}</p>}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-[var(--color-surface-lowest)] rounded-lg p-1">
            {[
              { id: 'preview', label: 'Preview', icon: Eye },
              { id: 'edit', label: 'Edit', icon: Edit3 },
              { id: 'versions', label: 'Versions', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-none ${
                  mode === id 
                    ? 'bg-[var(--color-primary)] text-white shadow-sm' 
                    : 'bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all border border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
            >
              <Download size={13} /> Download
            </button>

            <label className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
              uploading 
                ? 'opacity-50 pointer-events-none' 
                : 'bg-[var(--color-primary)] text-white hover:opacity-90'
            }`}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading...' : 'New Version'}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUploadVersion}
                disabled={uploading}
              />
            </label>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all border border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[var(--color-surface)]">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
              <span className="text-sm text-[var(--color-on-surface-variant)]">
                {mode === 'preview' ? 'Loading preview...' : mode === 'edit' ? 'Loading editor...' : 'Loading versions...'}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-[var(--color-surface)]">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm font-medium text-[var(--color-on-surface)]">{error}</p>
              <button
                onClick={() => { if (mode === 'preview') fetchPreviewToken(); else if (mode === 'edit') fetchEditUrl(); else fetchVersions(); }}
                className="h-8 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold cursor-pointer border border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)]"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {/* PREVIEW MODE */}
          {mode === 'preview' && !error && (
            <div ref={previewContainerRef} className="w-full h-full">
              {/* If Box Preview SDK isn't loaded, fall back to iframe with token */}
              {previewToken && typeof Box === 'undefined' && (
                <iframe
                  src={`https://app.box.com/preview/expiring_embed/${previewToken}?showAnnotations=true&showDownload=true`}
                  title={`Preview: ${fileName}`}
                  className="w-full h-full border-none"
                  onLoad={() => setLoading(false)}
                  allow="fullscreen"
                />
              )}
            </div>
          )}

          {/* EDIT MODE */}
          {mode === 'edit' && embedUrl && !error && (
            <iframe
              src={embedUrl}
              title={`Edit: ${fileName}`}
              className="w-full h-full border-none"
              onLoad={() => setLoading(false)}
              allow="fullscreen; local-network-access *; clipboard-read *; clipboard-write *"
              allowFullScreen
            />
          )}

          {/* VERSIONS MODE */}
          {mode === 'versions' && !loading && !error && (
            <div className="p-6 overflow-y-auto h-full">
              <h4 className="text-sm font-bold text-[var(--color-on-surface)] mb-4">Version History</h4>
              {versions.length === 0 ? (
                <p className="text-sm text-[var(--color-on-surface-variant)]">No version history available.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, i) => (
                    <div 
                      key={v.versionId || i}
                      className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
                          v{v.versionNumber || versions.length - i}
                        </div>
                        <div>
                          <p className="m-0 text-sm font-medium text-[var(--color-on-surface)]">
                            {v.name || fileName}
                            {i === 0 && <span className="ml-2 text-xs text-[var(--color-primary)] font-semibold">(Current)</span>}
                          </p>
                          <p className="m-0 text-xs text-[var(--color-on-surface-variant)]">
                            {v.modifiedBy && `by ${v.modifiedBy} · `}
                            {v.modifiedAt && new Date(v.modifiedAt).toLocaleString()}
                            {v.size > 0 && ` · ${formatFileSize(v.size)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="h-7 px-3 rounded-md flex items-center gap-1 text-xs font-medium cursor-pointer border border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
                      >
                        <Download size={11} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
