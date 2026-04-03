import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Loader2, Send, Pencil, X, Check, AtSign } from 'lucide-react'
import { commentApi } from '../services/api'
import { GlassPanel } from './ui'

const TYPE_STYLES = {
  review: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', color: '#3b82f6', label: 'Review' },
  internal: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', color: '#f97316', label: 'Internal' },
  system: { bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)', color: '#6b7280', label: 'System' },
}

function getInitials(name) {
  if (!name) return '??'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function absoluteTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function CommentSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="h-10 rounded-lg bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MentionDropdown({ items, onSelect, position }) {
  if (!items.length) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: position?.bottom ?? 'auto',
        left: position?.left ?? 0,
        zIndex: 50,
        minWidth: 200,
        maxHeight: 180,
        overflowY: 'auto',
      }}
      className="rounded-xl border border-white/[0.1] bg-[rgba(15,15,20,0.95)] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
    >
      {items.map(emp => (
        <button
          key={emp.id}
          onClick={() => onSelect(emp)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
            style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}
          >
            {getInitials(emp.name)}
          </div>
          {emp.name}
        </button>
      ))}
    </div>
  )
}

function CommentItem({ comment, onEditSave }) {
  const style = TYPE_STYLES[comment.type] || TYPE_STYLES.system
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.text)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const handleSave = async () => {
    if (!editText.trim()) { setEditError('Comment text cannot be empty'); return }
    setEditLoading(true)
    setEditError('')
    try {
      await onEditSave(comment.id, editText)
      setEditing(false)
    } catch (err) {
      if (err.message?.includes('422') || err.message?.includes('expired')) {
        setEditError('Edit window has expired.')
      } else {
        setEditError(err.message || 'Edit failed')
      }
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{
          background: `${style.bg}`,
          color: style.color,
          border: `1px solid ${style.border}`,
        }}
      >
        {comment.type === 'system' ? '⚙' : getInitials(comment.authorName)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[12px] font-semibold text-white/80">
            {comment.type === 'system' ? 'System' : comment.authorName}
          </span>
          {/* Type pill */}
          <span
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}
          >
            {style.label}
          </span>
          {/* Timestamp */}
          <span
            className="text-[10px] text-white/30 cursor-default"
            title={absoluteTime(comment.createdAt)}
          >
            {relativeTime(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className="text-[10px] text-white/20 italic">(edited)</span>
          )}
        </div>

        {/* Body or edit mode */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={e => { setEditText(e.target.value); setEditError('') }}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] text-white/80 outline-none focus:border-white/[0.2]"
            />
            {editError && <p className="m-0 text-[11px] text-red-400 font-medium">{editError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={editLoading}
                className="flex items-center gap-1 rounded-lg bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-white/70 border border-white/[0.1] hover:bg-white/[0.12] disabled:opacity-50 transition-colors"
              >
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(comment.text); setEditError('') }}
                className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/50 border border-white/[0.07] hover:bg-white/[0.08] transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="m-0 text-[13px] text-white/60 leading-relaxed whitespace-pre-wrap break-words flex-1">
              {comment.text}
            </p>
            {comment.isEditable && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <Pencil size={10} /> Edit
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const MAX_COMMENT_LENGTH = 2000

export default function CommentsThread({ documentId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // New comment form
  const [commentType, setCommentType] = useState('internal')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // @mention state
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionResults, setMentionResults] = useState([])
  const [trackedMentions, setTrackedMentions] = useState([])
  const textareaRef = useRef(null)
  const threadEndRef = useRef(null)

  const fetchComments = useCallback(async () => {
    if (!documentId) return
    setLoading(true)
    setError(null)
    try {
      const data = await commentApi.getComments(documentId)
      setComments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { fetchComments() }, [fetchComments])

  // Auto-scroll on new comment
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  // @mention search
  useEffect(() => {
    if (mentionQuery === null || mentionQuery === '') {
      setMentionResults([])
      return
    }
    let cancelled = false
    const search = async () => {
      try {
        const results = await commentApi.searchEmployees(mentionQuery)
        if (!cancelled) setMentionResults(Array.isArray(results) ? results : [])
      } catch {
        if (!cancelled) setMentionResults([])
      }
    }
    search()
    return () => { cancelled = true }
  }, [mentionQuery])

  const handleTextChange = (e) => {
    const val = e.target.value
    if (val.length > MAX_COMMENT_LENGTH) return
    setText(val)

    // Detect @mention
    const cursorPos = e.target.selectionStart
    const textBefore = val.slice(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }

  const handleMentionSelect = (emp) => {
    const cursorPos = textareaRef.current?.selectionStart || text.length
    const textBefore = text.slice(0, cursorPos)
    const textAfter = text.slice(cursorPos)
    const atIdx = textBefore.lastIndexOf('@')
    const newText = textBefore.slice(0, atIdx) + `@${emp.name} ` + textAfter
    setText(newText)
    setMentionQuery(null)
    setMentionResults([])
    setTrackedMentions(prev => [...prev, emp.id])
    textareaRef.current?.focus()
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const newComment = await commentApi.addComment(documentId, {
        type: commentType,
        authorId: 'employee-1',
        authorName: 'Current User',
        text: trimmed,
        mentions: trackedMentions,
      })
      setComments(prev => [...prev, newComment])
      setText('')
      setTrackedMentions([])
    } catch (err) {
      setSubmitError(err.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleEditSave = async (commentId, newText) => {
    const updated = await commentApi.editComment(commentId, { text: newText, requesterId: 'employee-1' })
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, ...updated } : c))
  }

  return (
    <GlassPanel>
      <h3 className="m-0 mb-5 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
        <MessageSquare size={14} /> Comments
      </h3>

      {loading ? (
        <CommentSkeleton />
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-[12px] text-red-400/70 mb-2">{error}</p>
          <button
            onClick={fetchComments}
            className="text-[11px] font-bold text-white/40 hover:text-white/60 underline transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Thread */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {comments.length === 0 && (
              <p className="text-[12px] text-white/30 text-center py-4">No comments yet</p>
            )}
            <AnimatePresence>
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} onEditSave={handleEditSave} />
              ))}
            </AnimatePresence>
            <div ref={threadEndRef} />
          </div>

          {/* New comment form */}
          <div className="border-t border-white/[0.06] pt-4 space-y-3">
            {/* Type toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setCommentType('internal')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border ${
                  commentType === 'internal'
                    ? 'bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.25)] text-[#f97316]'
                    : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.06]'
                }`}
              >
                Internal Note
              </button>
              <button
                onClick={() => setCommentType('review')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border ${
                  commentType === 'review'
                    ? 'bg-[rgba(59,130,246,0.12)] border-[rgba(59,130,246,0.25)] text-[#3b82f6]'
                    : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.06]'
                }`}
              >
                Review Note (Visible to Client)
              </button>
            </div>

            {/* Textarea with mention support */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Add a note..."
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white/70 placeholder-white/25 outline-none focus:border-white/[0.15] transition-colors"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/20">{text.length}/{MAX_COMMENT_LENGTH}</span>
                <span className="text-[10px] text-white/20">Ctrl+Enter to submit</span>
              </div>
              {mentionResults.length > 0 && (
                <MentionDropdown
                  items={mentionResults}
                  onSelect={handleMentionSelect}
                  position={{ bottom: '100%', left: 0 }}
                />
              )}
            </div>

            {submitError && (
              <p className="m-0 text-[11px] text-red-400 font-medium">{submitError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.1] px-4 py-2.5 text-[12px] font-bold text-white/60 hover:bg-white/[0.12] hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Add Note
            </button>
          </div>
        </>
      )}
    </GlassPanel>
  )
}
