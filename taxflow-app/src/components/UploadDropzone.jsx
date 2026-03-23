import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Shield, CheckCircle } from 'lucide-react'
import { documentApi } from '../services/api.js'

export default function UploadDropzone({ onUpload, disabled = false, folderId, requestId }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [complete, setComplete] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)

  const startRealUpload = useCallback(async (file) => {
    if (!folderId) {
      console.error('No folderId provided for upload')
      return
    }

    setFileName(file.name)
    setUploading(true)
    setProgress(0)
    setComplete(false)

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90)) // Cap at 90% until upload completes
      }, 100)

      // Upload to API
      const result = await documentApi.upload(file, folderId, requestId)
      
      // Complete progress
      clearInterval(progressInterval)
      setProgress(100)
      setComplete(true)

      // Show checkmark for 800ms, then call onUpload
      setTimeout(() => {
        setUploading(false)
        setComplete(false)
        setProgress(0)
        setFileName('')
        onUpload(file.name, result.file)
      }, 800)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploading(false)
      setProgress(0)
      setFileName('')
      alert(`Upload failed: ${error.message}`)
    }
  }, [folderId, requestId, onUpload])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    if (disabled || uploading) return
    setDragging(true)
  }, [disabled, uploading])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    if (disabled || uploading) return
    setDragging(false)
  }, [disabled, uploading])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || uploading) return
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      startRealUpload(files[0])
    }
  }, [disabled, uploading, startRealUpload])

  const handleFileSelect = useCallback((e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      startRealUpload(files[0])
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [startRealUpload])

  const handleClick = useCallback(() => {
    if (disabled || uploading) return
    fileInputRef.current?.click()
  }, [disabled, uploading])

  const isDisabled = disabled || uploading

  return (
    <div
      data-testid="upload-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative overflow-hidden rounded-[24px] border-2 border-dashed p-10 lg:p-14 text-center transition-all duration-300 ease-out flex flex-col items-center justify-center min-h-[300px] ${
        isDisabled
          ? 'cursor-not-allowed border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 opacity-60'
          : dragging
            ? 'cursor-pointer border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-[0_0_40px_rgba(var(--color-primary-rgb),0.15)_inset] scale-[1.02]'
            : 'cursor-pointer border-[var(--color-outline)] bg-[var(--color-surface-high)] hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-on-surface-variant)]'
      }`}
    >
      {dragging && !isDisabled && (
        <div className="absolute inset-0 bg-[var(--color-primary)]/5 backdrop-blur-sm z-0" />
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />
      
      <div className="relative z-10 w-full flex flex-col items-center">
        <AnimatePresence mode="wait">
          {complete ? (
            <motion.div
              key="complete"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="bg-[var(--color-secondary)]/15 p-4 rounded-full">
                <CheckCircle size={48} className="text-[var(--color-secondary)] drop-shadow-[0_0_12px_var(--color-secondary)]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="m-0 text-[18px] font-bold text-[var(--color-secondary)] tracking-tight">
                  Upload Complete
                </p>
                <p className="m-0 mt-1 text-[13px] font-medium text-[var(--color-on-surface-variant)]">
                  {fileName}
                </p>
              </div>
            </motion.div>
          ) : uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6 w-full max-w-[320px]"
            >
              <div className="w-14 h-14 rounded-[16px] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center relative shadow-[0_0_20px_var(--color-primary)]/20">
                <Upload size={24} className="text-[var(--color-primary)] animate-bounce" />
                <div className="absolute inset-0 border border-[var(--color-primary)] rounded-[16px] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50" />
              </div>

              <div className="text-center">
                <p className="m-0 text-[15px] font-bold text-[var(--color-on-surface)] tracking-tight">
                  Uploading <span className="text-[var(--color-primary)] truncate block max-w-[280px] mt-1">{fileName}</span>
                </p>
              </div>
              
              <div className="w-full">
                <div className="h-2 w-full rounded-full bg-[var(--color-surface-container)] overflow-hidden">
                  <motion.div
                    data-testid="upload-progress-bar"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-container)] relative"
                  >
                    <div className="absolute inset-0 bg-white/30 backdrop-blur-sm -skew-x-[30deg] -translate-x-full animate-[shimmer_1.5s_infinite]" />
                  </motion.div>
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-[11px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">Progress</span>
                  <span className="text-[12px] font-bold text-[var(--color-primary)] tabular-nums">{Math.round(progress)}%</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div
                className={`w-16 h-16 rounded-[20px] flex items-center justify-center mb-6 transition-all duration-300 ${
                  dragging
                    ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/50 shadow-[0_0_30px_var(--color-primary)]/30 scale-110'
                    : 'bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] shadow-sm'
                }`}
              >
                <Upload size={28} className={dragging ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]'} strokeWidth={2} />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-[var(--color-primary)]" />
                <h3 className="m-0 text-[18px] font-extrabold text-[var(--color-on-surface)] tracking-tight">
                  Upload to Box Secure Vault
                </h3>
              </div>
              
              <p className="m-0 mb-6 text-[14px] text-[var(--color-on-surface-variant)] leading-relaxed max-w-[300px]">
                {dragging
                  ? 'Release to upload your documents securely'
                  : 'Drag & drop your document here, or'}
              </p>

              <button
                onClick={handleClick}
                disabled={isDisabled}
                className="px-8 py-3.5 rounded-xl bg-[var(--color-on-surface)] text-[var(--color-surface-lowest)] text-[14px] font-bold tracking-wide transition-all duration-300 hover:bg-[var(--color-on-surface-variant)] hover:shadow-[0_8px_20px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 disabled:hover:bg-[var(--color-on-surface)]"
              >
                Browse Files
              </button>

              <div className="mt-8 pt-6 border-t border-[var(--color-outline-variant)] w-full max-w-[280px]">
                <p className="m-0 text-[10px] font-bold text-[var(--color-on-surface-variant)]/60 tracking-[0.15em] uppercase text-center flex items-center justify-center gap-2">
                  <Shield size={10} />
                  AES-256 Encrypted
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
