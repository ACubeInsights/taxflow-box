import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Loader2, Send, Pencil, X, Check } from 'lucide-react'
import { commentApi } from '../services/api'
import { FolioPanel as GlassPanel } from './ui'
import { useAuth } from '../context/AuthContext'
import { SkeletonAvatar, SkeletonLine } from './Skeleton'
import EmptyState from './EmptyState'

// Comment type visual styles — all using CSS custom properties
const TYPE_STYLES = {
  review: {
    bg: 'var(--color-primary-muted)',
    border: 'rgba(129,140,248,0.25)',
    color: 'var(--color-primary)',
    label: 'Review',
  },
  internal: {
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.25)',
    color: 'var(--color-warning)',
    label: 'Internal',
  },
  system: {
    bg: 'rgba(161,161,170,0.08)',
    border: 'rgba(161,161,170,0.15)',
    color: 'var(--color-on-surface-variant)',
    label: 'System',
  },
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
  return `${Math.floor(hrs / 24)}d ago`
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
        <div key={i} className="flex gap-3" style={{ animationDelay: `${i * 80}ms` }}>
          <SkeletonAvatar size="w-8 h-8" />
          <div className="flex-1 space-y-2 pt-1">
            <SkeletonLine width="w-24" height="h-2.5" />
            <SkeletonLine width="w-full" height="h-9" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MentionDropdown({ items, onSelect }) {
  if (!items.length) return null
  return (
    <div
      className="absolute bottom-full left-0 z-50 min-w-[200px] max-h-[180px] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] shadow-floating backdrop-blur-xl"
    >
      {items.map(emp => (
        <button
          key={emp.id}
          onClick={() => onSelect(emp)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)] hover:text-[var(--color-on-surface)] transition-colors"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
            style={{
              background: 'var(--color-primary-muted)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(129,140,248,0.25)',
            }}
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
    if (!editText.trim()) { setEditError('Comment cannot be empty'); return }
    setEditLoading(true)
    setEditError('')
    try {
      await onEditSave(comment.id, editText)
      setEditing(false)
    } catch (err) {
      setEditError(
        err.message?.includes('422') || err.message?.includes('expired')
          ? 'Edit window has expired.'
          : err.message || 'Edit failed'
      )
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
      >
        {comment.type === 'system' ? '⚙' : getInitials(comment.authorName)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[12px] font-semibold text-[var(--color-on-surface)]">
            {comment.type === 'system' ? 'System' : comment.authorName}
          </span>
          <span
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}
          >
            {style.label}
          </span>
          <span
            className="text-[10px] text-[var(--color-on-surface-variant)]/50 cursor-default"
            title={absoluteTime(comment.createdAt)}
          >
            {relativeTime(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className="text-[10px] text-[var(--color-on-surface-variant)]/30 italic">(edited)</span>
          )}
        </div>

        {/* Body or edit mode */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={e => { setEditText(e.target.value); setEditError('') }}
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] px-3 py-2 text-[13px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]/50 transition-colors"
            />
            {editError && (
              <p className="m-0 text-[11px] text-[var(--color-error)] font-medium">{editError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={editLoading}
                className="flex items-center gap-1 rounded-lg bg-[var(--color-surface-high)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)] disabled:opacity-50 transition-colors"
              >
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(comment.text); setEditError('') }}
                className="flex items-center gap-1 rounded-lg bg-transparent px-3 py-1.5 text-[11px] font-bold text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-high)] transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed whitespace-pre-wrap break-words flex-1">
              {comment.text}
            </p>
            {comment.isEditable && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-[var(--color-on-surface-variant)]/40 hover:text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)] transition-colors"
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
  const { user } = useAuth() || {}
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [commentType, setCommentType] = useState('internal')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  useEffect(() => {
    if (mentionQuery === null || mentionQuery === '') { setMentionResults([]); return }
    let cancelled = false
    commentApi.searchEmployees(mentionQuery)
      .then(r => { if (!cancelled) setMentionResults(Array.isArray(r) ? r : []) })
      .catch(() => { if (!cancelled) setMentionResults([]) })
    return () => { cancelled = true }
  }, [mentionQuery])

  const handleTextChange = (e) => {
    const val = e.target.value
    if (val.length > MAX_COMMENT_LENGTH) return
    setText(val)
    const textBefore = val.slice(0, e.target.selectionStart)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) { setMentionQuery(atMatch[1]) }
    else { setMentionQuery(null); setMentionResults([]) }
  }

  const handleMentionSelect = (emp) => {
    const cursorPos = textareaRef.current?.selectionStart || text.length
    const before = text.slice(0, cursorPos)
    const after = text.slice(cursorPos)
    setText(before.slice(0, before.lastIndexOf('@')) + `@${emp.name} ` + after)
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
        authorId: user?.id || 'employee-1',
        authorName: user?.name || 'Current User',
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

  const handleEditSave = async (commentId, newText) => {
    const updated = await commentApi.editComment(commentId, {
      text: newText,
      requesterId: user?.id || 'employee-1',
    })
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
          <p className="text-[12px] text-[var(--color-error)]/70 mb-2">{error}</p>
          <button
            onClick={fetchComments}
            className="text-[11px] font-bold text-[var(--color-on-surface-variant)]/50 hover:text-[var(--color-on-surface-variant)] underline transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Thread */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-1">
            {comments.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title="No comments yet"
                subtitle="Add an internal note or review comment below."
              />
            )}
            <AnimatePresence>
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} onEditSave={handleEditSave} />
              ))}
            </AnimatePresence>
            <div ref={threadEndRef} />
          </div>

          {/* New comment form */}
          <div className="border-t border-[var(--color-outline-variant)] pt-4 space-y-3">
            {/* Type toggle */}
            <div className="flex gap-2">
              {[
                { key: 'internal', label: 'Internal Note' },
                { key: 'review',   label: 'Review (visible to client)' },
              ].map(({ key, label }) => {
                const s = TYPE_STYLES[key]
                const active = commentType === key
                return (
                  <button
                    key={key}
                    onClick={() => setCommentType(key)}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border cursor-pointer"
                    style={active
                      ? { background: s.bg, borderColor: s.border, color: s.color }
                      : { background: 'transparent', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Textarea with @mention */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
                placeholder="Add a note... (@mention to notify)"
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                className="w-full resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] px-4 py-3 text-[13px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/40 outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-[var(--color-on-surface-variant)]/30">
                  {text.length}/{MAX_COMMENT_LENGTH}
                </span>
                <span className="text-[10px] text-[var(--color-on-surface-variant)]/30">⌘↵ to submit</span>
              </div>
              {mentionResults.length > 0 && (
                <MentionDropdown items={mentionResults} onSelect={handleMentionSelect} />
              )}
            </div>

            {submitError && (
              <p className="m-0 text-[11px] text-[var(--color-error)] font-medium">{submitError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] px-4 py-2.5 text-[12px] font-bold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
