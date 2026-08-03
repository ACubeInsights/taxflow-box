import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { notificationApi } from '../services/api'
import {
  Bell, LogOut, Upload, AtSign, RotateCcw, FileText,
  AlertCircle, KeyRound, ChevronDown, Clock,
} from 'lucide-react'
import ChangePasswordModal from './ChangePasswordModal'
import { ROLE_META } from '../constants/roles'

const EVENT_TYPE_ICONS = {
  document_uploaded:  Upload,
  mention:            AtSign,
  revision_requested: RotateCcw,
  request_published:  FileText,
  document_approved:  FileText,
  document_waived:    FileText,
  permission_updated: KeyRound,
  email_failed:       AlertCircle,
}

export default function TopNav() {
  const { user, logout, sessionWarning } = useAuth()
  const meta = ROLE_META[user?.role] || ROLE_META.employee

  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const pollRef = useRef(null)
  const profileRef = useRef(null)
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length
  const isStaff = user?.role === 'employee' || user?.role === 'superadmin'
  const showNotifBell = isStaff || user?.role === 'client'

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!user || !showNotifBell) {
      setNotifications([])
      return
    }

    const fetchNotifications = async () => {
      try {
        const data = await notificationApi.getNotifications(user.id)
        if (Array.isArray(data)) setNotifications(data)
      } catch { /* silent */ }
    }

    fetchNotifications()
    pollRef.current = setInterval(fetchNotifications, 30000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [user, showNotifBell])

  const handleLogout = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setShowProfile(false)
    logout()
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <header
        className="sticky top-0 z-50 flex h-[var(--layout-topbar)] items-center gap-[var(--space-4)] border-b border-[var(--color-rule)] bg-[var(--color-archive)] px-[var(--space-4)] sm:px-[var(--space-6)] lg:px-[var(--space-8)]"
      >
        {/* Brand */}
        <div className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
            aria-hidden
          >
            <span className="text-xs font-display font-bold text-[var(--color-signal)]">TF</span>
          </div>
          <span className="truncate font-display text-sm font-semibold text-[var(--color-ink)]">
            TaxFlow Pro
          </span>
          <span
            className="hidden sm:inline-flex items-center rounded-[var(--radius-chip)] px-[var(--space-2)] py-[var(--space-1)] text-xs font-medium uppercase tracking-[0.04em]"
            style={{
              color: meta.color,
              background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
            }}
          >
            {meta.badgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-[var(--space-1)]">
          {showNotifBell && (
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => { setShowNotifications(p => !p); setShowProfile(false) }}
                className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border-none bg-transparent text-[var(--color-whisper)] hover:bg-[var(--color-ledger)] hover:text-[var(--color-ink)] cursor-pointer"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={showNotifications}
              >
                <Bell size={16} aria-hidden />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-signal)] px-1 text-[10px] font-medium text-[var(--color-signal-ink)] pointer-events-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 top-11 z-[100] w-[min(320px,calc(100vw-2rem))] max-h-[360px] overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)] p-[var(--space-2)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                  role="menu"
                >
                  <p className="label-caps px-[var(--space-3)] py-[var(--space-2)] m-0">
                    Notifications{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                  </p>
                  {notifications.length === 0 ? (
                    <p className="m-0 px-[var(--space-3)] py-[var(--space-8)] text-center text-sm text-[var(--color-whisper)]">
                      No notifications yet
                    </p>
                  ) : (
                    notifications.slice(0, 8).map((n, i) => {
                      const EventIcon = EVENT_TYPE_ICONS[n.eventType] || Bell
                      return (
                        <div
                          key={n.id || i}
                          className="flex gap-[var(--space-3)] items-start rounded-[var(--radius-control)] p-[var(--space-3)]"
                          style={{
                            background: n.read
                              ? 'transparent'
                              : 'var(--color-signal-muted)',
                          }}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
                            <EventIcon size={12} className="text-[var(--color-trace)]" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="m-0 mb-[var(--space-1)] text-xs font-medium uppercase tracking-[0.04em] text-[var(--color-trace)]">
                              {(n.eventType || 'update').replace(/_/g, ' ')}
                            </p>
                            <p className="m-0 text-sm text-[var(--color-whisper)] leading-snug line-clamp-2">
                              {n.message}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => { setShowProfile(p => !p); setShowNotifications(false) }}
              className="flex h-9 items-center gap-[var(--space-2)] rounded-[var(--radius-control)] border-none bg-transparent pl-[var(--space-1)] pr-[var(--space-2)] cursor-pointer hover:bg-[var(--color-ledger)]"
              aria-label={`Account menu for ${user?.name || 'user'}`}
              aria-expanded={showProfile}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-chip)] text-xs font-bold"
                style={{
                  background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                  color: meta.color,
                }}
                aria-hidden
              >
                {initials}
              </div>
              <span className="hidden max-w-[80px] truncate text-sm font-medium text-[var(--color-whisper)] sm:inline">
                {user?.name?.split(' ')[0] || 'Account'}
              </span>
              <ChevronDown
                size={12}
                className="text-[var(--color-whisper)]"
                style={{ transform: showProfile ? 'rotate(180deg)' : 'none' }}
                aria-hidden
              />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-11 z-[100] w-[210px] rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)] p-[var(--space-1)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                <div className="mb-[var(--space-1)] border-b border-[var(--color-rule)] px-[var(--space-3)] py-[var(--space-3)]">
                  <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">
                    {user?.name || 'User'}
                  </p>
                  <p className="m-0 mt-[var(--space-1)] truncate text-xs text-[var(--color-whisper)]">
                    {user?.email || ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowProfile(false); setChangePasswordOpen(true) }}
                  className="flex w-full cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--radius-control)] border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--color-ledger)]"
                >
                  <KeyRound size={14} className="text-[var(--color-whisper)]" aria-hidden />
                  <span className="text-sm font-medium text-[var(--color-ink)]">Change password</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--radius-control)] border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--color-flag-muted)]"
                >
                  <LogOut size={14} className="text-[var(--color-flag)]" aria-hidden />
                  <span className="text-sm font-medium text-[var(--color-flag)]">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {sessionWarning && (
        <div
          className="sticky top-[var(--layout-topbar)] z-40 flex items-center justify-center gap-[var(--space-2)] border-b border-[var(--color-hold)] bg-[var(--color-hold-muted)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--color-hold)]"
          role="status"
        >
          <Clock size={14} className="shrink-0" aria-hidden />
          <span className="text-sm font-medium">
            Your session ends in less than 5 minutes. Move the mouse or press a key to stay signed in.
          </span>
        </div>
      )}

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  )
}
