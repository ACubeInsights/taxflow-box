import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, FileSpreadsheet, Image, File,
  Download, Loader2, AlertCircle, RefreshCw, FolderOpen, Eye, X,
} from 'lucide-react'
import { GlassPanel, PanelTitle } from './ui'
import { useAuth } from '../context/AuthContext'
import { vaultApi } from '../services/api'
import { formatFileSize, getFileIcon, sortFilesByDate } from '../utils/fileUtils'
import UploadDropzone from './UploadDropzone'

const ICON_MAP = { FileText, FileSpreadsheet, Image, File }

const TABS = [
  { key: 'uploads', label: 'Uploads', folderIdKey: 'uploads' },
  { key: 'tax', label: 'Tax Returns', folderIdKey: 'tax' },
  { key: 'signedDocuments', label: 'Signed Documents', folderIdKey: 'signedDocuments' },
]

function FileIcon({ fileName, size = 18 }) {
  const iconName = getFileIcon(fileName)
  const IconComponent = ICON_MAP[iconName] || File
  return <IconComponent size={size} className="text-[var(--color-on-surface-variant)] shrink-0" />
}

function FileEntry({ file, onDownload, onPreview, downloading }) {
  const modified = file.modified_at
    ? new Date(file.modified_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  return (
    <div
      className="flex items-center gap-4 p-3.5 rounded-[14px] bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:ring-[var(--color-outline)] group cursor-pointer"
      onClick={() => onPreview(file)}
    >
      <div className="w-9 h-9 rounded-[10px] bg-[var(--color-surface-container)] flex items-center justify-center border border-[var(--color-outline-variant)] shrink-0">
        <FileIcon fileName={file.name} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate leading-snug">
          {file.name}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-[var(--color-on-surface-variant)] font-medium">
            {formatFileSize(file.size || 0)}
          </span>
          {modified && (
            <span className="text-[11px] text-[var(--color-on-surface-variant)] font-medium">
              {modified}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onPreview(file); }}
        className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] transition-all duration-200 hover:bg-[var(--color-tertiary)]/10 hover:border-[var(--color-tertiary)]/30 hover:text-[var(--color-tertiary)] shrink-0 cursor-pointer"
        title="Preview"
      >
        <Eye size={14} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDownload(file.id); }}
        disabled={downloading === file.id}
        className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] transition-all duration-200 hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        title="Download"
      >
        {downloading === file.id
          ? <Loader2 size={14} className="animate-spin" />
          : <Download size={14} />
        }
      </button>
    </div>
  )
}

export default function VaultBrowser() {
  const { user } = useAuth() || {}
  const vault = user?.vault || null

  const [activeTab, setActiveTab] = useState('uploads')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  const getFolderId = useCallback((tabKey) => {
    if (!vault) return null
    const tab = TABS.find(t => t.key === tabKey)
    return tab ? vault[tab.folderIdKey] : null
  }, [vault])

  const fetchFiles = useCallback(async (tabKey, isRefresh = false) => {
    const folderId = getFolderId(tabKey)
    if (!folderId) return

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
      setError(null)
    }

    try {
      const data = await vaultApi.listFiles(folderId)
      const sorted = sortFilesByDate(data.files || [])
      setFiles(sorted)
      setError(null)
    } catch (err) {
      if (!isRefresh) {
        setError(err.message || 'Failed to load files')
        setFiles([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getFolderId])

  // Fetch files on mount and tab switch
  useEffect(() => {
    if (vault) {
      fetchFiles(activeTab)
    }
  }, [activeTab, vault, fetchFiles])

  const handleTabSwitch = (tabKey) => {
    if (tabKey === activeTab) return
    setActiveTab(tabKey)
  }

  const handleDownload = async (fileId) => {
    setDownloading(fileId)
    setDownloadError(null)
    try {
      const data = await vaultApi.getDownloadUrl(fileId)
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setDownloadError(err.message || 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const handleUploadComplete = () => {
    fetchFiles(activeTab, true)
  }

  const handlePreview = async (file) => {
    setPreviewFile(file)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl(null)
    setPreviewContent(null)

    const ext = (file.name || '').split('.').pop()?.toLowerCase()
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)
    const isText = ['csv', 'txt', 'json', 'xml', 'md', 'log'].includes(ext)
    const isPdf = ext === 'pdf'

    try {
      const data = await vaultApi.getDownloadUrl(file.id)
      if (!data.downloadUrl) throw new Error('No download URL returned')

      if (isImage || isPdf) {
        setPreviewUrl(data.downloadUrl)
      } else if (isText) {
        const resp = await fetch(data.downloadUrl)
        const text = await resp.text()
        setPreviewContent(text)
      } else {
        // Unsupported type — show download prompt
        setPreviewUrl(null)
        setPreviewContent(null)
      }
    } catch (err) {
      setPreviewError(err.message || 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewFile(null)
    setPreviewUrl(null)
    setPreviewContent(null)
    setPreviewError(null)
  }

  const getPreviewType = (fileName) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (['csv', 'txt', 'json', 'xml', 'md', 'log'].includes(ext)) return 'text'
    return 'unsupported'
  }

  // No vault data — show setup message
  if (!vault) {
    return (
      <GlassPanel delay={250}>
        <PanelTitle>My Documents</PanelTitle>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-[16px] bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] flex items-center justify-center mb-4">
            <FolderOpen size={24} className="text-[var(--color-on-surface-variant)]" />
          </div>
          <p className="m-0 text-[14px] font-semibold text-[var(--color-on-surface)] mb-1">
            Vault being set up
          </p>
          <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] max-w-[280px]">
            Your secure document vault is being configured. Documents will be available shortly.
          </p>
        </div>
      </GlassPanel>
    )
  }

  const currentTab = TABS.find(t => t.key === activeTab)
  const uploadFolderId = vault?.uploads || null

  return (
    <GlassPanel delay={250}>
      <PanelTitle>My Documents</PanelTitle>

      {/* Folder Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabSwitch(tab.key)}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold tracking-wide transition-all duration-200 cursor-pointer border ${
              activeTab === tab.key
                ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                : 'bg-transparent border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Refreshing indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />
          <span className="text-[11px] text-[var(--color-on-surface-variant)] font-medium">Refreshing…</span>
        </div>
      )}

      {/* Download error toast */}
      {downloadError && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[#f87171]/10 border border-[#f87171]/20">
          <AlertCircle size={14} className="text-[#f87171] shrink-0" />
          <span className="text-[12px] text-[#f87171] font-medium flex-1">{downloadError}</span>
          <button
            onClick={() => setDownloadError(null)}
            className="text-[11px] text-[#f87171] font-bold cursor-pointer bg-transparent border-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)] mb-3" />
          <span className="text-[12px] text-[var(--color-on-surface-variant)] font-medium">Loading files…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={28} className="text-[#f87171] mb-3" />
          <p className="m-0 text-[13px] text-[#f87171] font-semibold mb-1">Failed to load files</p>
          <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] mb-4 max-w-[280px]">{error}</p>
          <button
            onClick={() => fetchFiles(activeTab)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171] text-[12px] font-bold cursor-pointer transition-all duration-200 hover:bg-[#f87171]/20"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* File list */}
      {!loading && !error && (
        <>
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen size={28} className="text-[var(--color-on-surface-variant)] mb-3 opacity-50" />
              <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] font-medium">
                No files in {currentTab?.label || 'this folder'} yet
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map(file => (
                <FileEntry
                  key={file.id}
                  file={file}
                  onDownload={handleDownload}
                  onPreview={handlePreview}
                  downloading={downloading}
                />
              ))}
            </div>
          )}

          {/* Upload dropzone — only on Uploads tab */}
          {activeTab === 'uploads' && uploadFolderId && (
            <div className="mt-5">
              <UploadDropzone
                folderId={uploadFolderId}
                onUpload={handleUploadComplete}
                disabled={false}
              />
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <>
            <motion.div
              key="preview-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
              onClick={closePreview}
            />
            <motion.div
              key="preview-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-4 z-[201] flex flex-col rounded-[20px] bg-[var(--color-surface)] border border-[var(--color-outline-variant)] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-high)]/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon fileName={previewFile.name} size={20} />
                  <h3 className="m-0 text-[15px] font-bold text-[var(--color-on-surface)] truncate">
                    {previewFile.name}
                  </h3>
                  <span className="text-[11px] text-[var(--color-on-surface-variant)] font-medium shrink-0">
                    {formatFileSize(previewFile.size || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(previewFile.id)}
                    className="h-8 px-3 rounded-lg flex items-center gap-1.5 bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] text-[12px] font-bold cursor-pointer transition-all hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    onClick={closePreview}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer transition-all hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)]"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 flex items-center justify-center bg-[var(--color-surface-container)] overflow-auto">
                {previewLoading && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
                    <span className="text-[13px] text-[var(--color-on-surface-variant)] font-medium">Loading preview…</span>
                  </div>
                )}
                {previewError && (
                  <div className="flex flex-col items-center gap-3 text-center px-8">
                    <AlertCircle size={32} className="text-[#f87171]" />
                    <p className="m-0 text-[13px] text-[#f87171] font-semibold">Preview unavailable</p>
                    <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] max-w-[300px]">{previewError}</p>
                    <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">You can still download the file.</p>
                  </div>
                )}
                {!previewLoading && !previewError && previewFile && (() => {
                  const type = getPreviewType(previewFile.name)
                  if (type === 'image' && previewUrl) {
                    return <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain p-4" />
                  }
                  if (type === 'pdf' && previewUrl) {
                    return <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={previewFile.name} />
                  }
                  if (type === 'text' && previewContent !== null) {
                    return (
                      <pre className="w-full h-full m-0 p-6 overflow-auto text-[13px] font-mono text-[var(--color-on-surface)] bg-[var(--color-surface)] whitespace-pre-wrap break-words">
                        {previewContent}
                      </pre>
                    )
                  }
                  // Unsupported type
                  return (
                    <div className="flex flex-col items-center gap-4 text-center px-8">
                      <FileIcon fileName={previewFile.name} size={48} />
                      <p className="m-0 text-[14px] font-semibold text-[var(--color-on-surface)]">
                        Preview not available for this file type
                      </p>
                      <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] max-w-[300px]">
                        Download the file to view it in its native application.
                      </p>
                      <button
                        onClick={() => handleDownload(previewFile.id)}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--color-on-surface)] text-[var(--color-surface-lowest)] text-[13px] font-bold cursor-pointer transition-all hover:bg-[var(--color-on-surface-variant)] active:scale-95"
                      >
                        <Download size={14} className="inline mr-1.5 -mt-0.5" /> Download File
                      </button>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </GlassPanel>
  )
}
