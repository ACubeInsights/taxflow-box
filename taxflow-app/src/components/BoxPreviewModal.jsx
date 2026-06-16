import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { vaultApi } from '../services/api'
import { formatFileSize } from '../utils/fileUtils'

/**
 * BoxPreviewModal — Renders Box's native file preview via expiring embed link.
 * Uses Box's built-in iframe-based viewer which supports 120+ file types.
 * No external SDK or CDN scripts needed — just an iframe with Box's embed URL.
 */
export default function BoxPreviewModal({ fileId, fileName, fileSize, userId, canDownload = true, onClose, onDownload }) {
  const [embedUrl, setEmbedUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEmbed = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await vaultApi.getEmbedUrl(fileId)
      setEmbedUrl(result.embedUrl)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('404') || msg.includes('not available'))
        setError('Preview is not available for this file type.')
      else if (msg.includes('401'))
        setError('Please log in again to view this file.')
      else
        setError('Unable to load preview. Try downloading the file.')
      console.error('[BoxPreviewModal] Embed fetch error', { fileId, message: err.message })
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useEffect(() => { fetchEmbed() }, [fetchEmbed])

  // Escape key handler
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="box-preview-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="box-preview-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-5 z-[201] flex flex-col rounded-[24px] overflow-hidden ring-1 ring-[var(--color-outline-variant)]"
        style={{ background: 'var(--color-surface)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/60 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--color-on-surface-variant)]"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}
            >
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{fileName}</h3>
              {fileSize > 0 && <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">{formatFileSize(fileSize)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDownload && (
              <button
                onClick={onDownload}
                className="h-9 px-4 rounded-[10px] flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all duration-200"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)', color: 'var(--color-primary)' }}
              >
                <Download size={13} /> Download
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer transition-all duration-200 ring-1 ring-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview content area */}
        <div className="flex-1 relative overflow-hidden bg-[#1a1a2e]">
          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[var(--color-surface-lowest)]">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
              <span className="text-[13px] text-[var(--color-on-surface-variant)] font-medium">Loading preview…</span>
            </div>
          )}

          {/* Error with download fallback */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 px-8 text-center bg-[var(--color-surface-lowest)]">
              <AlertCircle size={32} className="text-[#f87171]" />
              <p className="m-0 text-[14px] font-semibold text-[var(--color-on-surface)]">{error}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchEmbed}
                  className="h-9 px-4 rounded-[10px] flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all ring-1 ring-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)]"
                >
                  <RefreshCw size={13} /> Retry
                </button>
                <button
                  onClick={onDownload}
                  className="h-9 px-4 rounded-[10px] flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-surface-lowest)', boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 35%, transparent)' }}
                >
                  <Download size={13} /> Download File
                </button>
              </div>
            </div>
          )}

          {/* Box iframe embed — renders when embedUrl is ready */}
          {embedUrl && !error && (
            <iframe
              src={embedUrl}
              title={`Preview: ${fileName}`}
              className="w-full h-full border-none"
              style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.3s' }}
              onLoad={() => setLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="fullscreen"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
