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
      style={{
        borderRadius: 22,
        border: `2px dashed ${dragging && !isDisabled ? '#06b6d4' : isDisabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
        background: dragging && !isDisabled
          ? 'rgba(6,182,212,0.07)'
          : isDisabled
            ? 'rgba(255,255,255,0.01)'
            : 'rgba(255,255,255,0.02)',
        backdropFilter: dragging && !isDisabled ? 'blur(8px)' : 'none',
        padding: '48px 32px',
        textAlign: 'center',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: dragging && !isDisabled
          ? '0 0 40px rgba(6,182,212,0.15), inset 0 0 40px rgba(6,182,212,0.04)'
          : 'none',
        opacity: disabled && !uploading ? 0.4 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept="*/*"
      />
      <AnimatePresence mode="wait">
        {complete ? (
          <motion.div
            key="complete"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
          >
            <CheckCircle size={48} color="#22c55e" strokeWidth={2} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#22c55e' }}>
              Upload Complete
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {fileName}
            </p>
          </motion.div>
        ) : uploading ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Uploading {fileName}…
            </p>
            <div style={{ width: '100%', maxWidth: 320 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  data-testid="upload-progress-bar"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.15 }}
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    background: '#06b6d4',
                    boxShadow: '0 0 8px rgba(6,182,212,0.6)',
                  }}
                />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                {Math.round(progress)}%
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: dragging ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${dragging ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                transition: 'all 0.2s',
                boxShadow: dragging ? '0 0 24px rgba(6,182,212,0.3)' : 'none',
              }}
            >
              <Upload size={26} color={dragging ? '#06b6d4' : 'rgba(255,255,255,0.3)'} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              <Shield size={14} color="#06b6d4" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                Upload to Box Secure Vault
              </h3>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
              {dragging
                ? 'Release to upload your documents securely'
                : 'Drag & drop your document here'}
            </p>

            <button
              onClick={handleClick}
              style={{
                padding: '11px 28px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(6,182,212,0.85), rgba(99,102,241,0.8))',
                border: '1px solid rgba(6,182,212,0.35)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(6,182,212,0.2)',
                transition: 'all 0.2s',
                letterSpacing: '-0.01em',
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              Choose Files
            </button>

            <p style={{ margin: '16px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>
              AES-256 ENCRYPTION · SOC 2 TYPE II · ZERO-KNOWLEDGE STORAGE
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
