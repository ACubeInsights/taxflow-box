import { useState, useRef, useCallback } from 'react'
import { Upload, Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { documentApi } from '../services/api.js'

/**
 * Upload dropzone — Folio Desk.
 * Progress is indeterminate until the server responds (no fake % animation).
 */
export default function UploadDropzone({ onUpload, disabled = false, folderId, requestId }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const progressIntervalRef = useRef(null)

  const isValidFolderId = folderId && folderId !== '0' && folderId !== ''

  const clearProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  const startRealUpload = useCallback(async (file) => {
    if (!isValidFolderId) return

    setFileName(file.name)
    setUploading(true)
    setComplete(false)
    setUploadError(null)

    try {
      const result = await documentApi.upload(file, folderId, requestId)
      setComplete(true)
      setTimeout(() => {
        setUploading(false)
        setComplete(false)
        setFileName('')
        onUpload?.(file.name, result.file)
      }, 800)
    } catch (error) {
      setUploading(false)
      setFileName('')
      setUploadError(error.message || 'Upload failed')
    } finally {
      clearProgress()
    }
  }, [isValidFolderId, folderId, requestId, onUpload])

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
    if (files?.length > 0) startRealUpload(files[0])
  }, [disabled, uploading, startRealUpload])

  const handleFileSelect = useCallback((e) => {
    const files = e.target.files
    if (files?.length > 0) startRealUpload(files[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [startRealUpload])

  const isDisabled = disabled || uploading || !isValidFolderId

  if (!isValidFolderId && !uploading && !complete) {
    return (
      <div
        data-testid="upload-dropzone"
        className="flex min-h-[200px] flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--color-rule)] bg-[var(--color-folio)] p-[var(--space-8)] text-center opacity-70"
      >
        <Shield size={24} className="mb-[var(--space-3)] text-[var(--color-whisper)]" aria-hidden />
        <p className="m-0 text-sm font-medium text-[var(--color-ink)]">Upload folder not ready</p>
        <p className="m-0 mt-[var(--space-2)] max-w-[280px] text-sm text-[var(--color-whisper)]">
          Your vault folder is still being configured. Try again shortly.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="upload-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex min-h-[200px] flex-col items-center justify-center rounded-[var(--radius-panel)]
        border border-dashed p-[var(--space-8)] text-center
        ${isDisabled
          ? 'cursor-not-allowed border-[var(--color-rule)] bg-[var(--color-folio)] opacity-60'
          : dragging
            ? 'cursor-pointer border-[var(--color-signal)] bg-[var(--color-signal-muted)]'
            : 'cursor-pointer border-[var(--color-rule)] bg-[var(--color-folio)] hover:border-[var(--color-whisper)]'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
        disabled={isDisabled}
      />

      {complete ? (
        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <CheckCircle size={36} className="text-[var(--color-commit)]" aria-hidden />
          <p className="m-0 text-sm font-medium text-[var(--color-commit)]">Uploaded</p>
          <p className="m-0 text-sm text-[var(--color-whisper)]">{fileName}</p>
        </div>
      ) : uploading ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-[var(--space-4)]">
          <Loader2 size={28} className="animate-spin text-[var(--color-signal)]" aria-hidden />
          <p className="m-0 text-sm font-medium text-[var(--color-ink)]">
            Uploading <span className="block truncate text-[var(--color-whisper)]">{fileName}</span>
          </p>
          <div className="h-[6px] w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-ledger)]">
            <div
              data-testid="upload-progress-bar"
              className="h-full w-1/2 animate-pulse rounded-[var(--radius-chip)] bg-[var(--color-signal)]"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="mb-[var(--space-4)] flex h-12 w-12 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
            <Upload size={22} className="text-[var(--color-whisper)]" aria-hidden />
          </div>
          <h3 className="m-0 mb-[var(--space-2)] text-md font-display font-semibold text-[var(--color-ink)]">
            Upload to your vault
          </h3>
          <p className="m-0 mb-[var(--space-6)] max-w-[280px] text-sm text-[var(--color-whisper)]">
            {dragging ? 'Drop the file to upload it' : 'Drag a file here, or choose one from your device'}
          </p>
          <button
            type="button"
            onClick={() => { if (!isDisabled) fileInputRef.current?.click() }}
            disabled={isDisabled}
            className="btn-signal"
          >
            Choose file
          </button>
        </div>
      )}

      {uploadError && (
        <div
          className="mt-[var(--space-4)] flex w-full max-w-xs items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-3)] py-[var(--space-2)]"
          role="alert"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
          <span className="flex-1 text-left text-sm text-[var(--color-flag)]">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="cursor-pointer border-none bg-transparent p-0 text-xs font-medium text-[var(--color-flag)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
