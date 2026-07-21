import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { notificationApi } from '../services/api'
import { Bell, LogOut, Upload, AtSign, RotateCcw, FileText, AlertCircle, KeyRound, ChevronDown } from 'lucide-react'
import ChangePasswordModal from './ChangePasswordModal'

const EVENT_TYPE_ICONS = {
  document_uploaded: Upload,
  mention: AtSign,
  revision_requested: RotateCcw,
  request_published: FileText,
  email_failed: AlertCircle,
}

const ROLE_META = {
  superadmin: { label: 'Admin', color: '#818cf8' },
  employee: { label: 'Preparer', color: '#c4b5fd' },
  client: { label: 'Client', color: '#5eead4' },
}

export default function TopNav() {
  const { user, logout } = useAuth()
  const meta = ROLE_META[user?.role] || ROLE_META.employee
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const pollRef = useRef(null)
  const profileRef = useRef(null)
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length
  const isEmployee = user?.role === 'employee'

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Poll notifications every 30 seconds — employee role only
  useEffect(() => {
    if (!user || !isEmployee) {
      setNotifications([])
      return
    }

    const fetchNotifications = async () => {
      try {
        const data = await notificationApi.getNotifications(user?.id || 'employee-1')
        if (Array.isArray(data)) setNotifications(data)
      } catch { /* silent */ }
    }

    fetchNotifications()
    pollRef.current = setInterval(fetchNotifications, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [user, isEmployee])

  const handleLogout = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setShowProfile(false)
    logout()
  }

  return (
    <header className="h-14 border-b border-[var(--color-outline-variant)] flex items-center px-6 lg:px-8 gap-4 sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl">
      {/* Left: Brand */}
      <div className="flex items-center gap-2.5 flex-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
          <span className="text-[11px] font-bold text-[var(--color-primary)]">TF</span>
        </div>
        <span className="text-[14px] font-semibold text-[var(--color-on-surface)] tracking-tight font-display">
          TaxFlow Pro
        </span>
        <span
          className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}20` }}
        >
          {meta.label}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">

        {/* Notifications — employee only */}
        {isEmployee && (
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-high)] transition-colors border-none bg-transparent cursor-pointer"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[9px] font-bold text-[#09090b] px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute top-10 right-0 w-[320px] max-h-[360px] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1.5 z-[100] shadow-floating">
                <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] px-3 py-2 uppercase tracking-wider">
                  Notifications {unreadCount > 0 && `(${unreadCount})`}
                </p>
                {notifications.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-on-surface-variant)] py-6 text-center opacity-60">No notifications yet</p>
                ) : (
                  notifications.slice(0, 8).map((n, i) => {
                    const EventIcon = EVENT_TYPE_ICONS[n.eventType] || Bell
                    return (
                      <div
                        key={n.id || i}
                        className="flex gap-2.5 items-start p-2.5 rounded-lg transition-colors hover:bg-[var(--color-surface-high)]"
                        style={{ background: n.read ? 'transparent' : 'rgba(129,140,248,0.04)' }}
                      >
                        <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/15">
                          <EventIcon size={12} className="text-[var(--color-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-wide">
                              {n.eventType?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] leading-relaxed line-clamp-2">
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

        {/* Profile menu */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(prev => !prev)}
            className="flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-high)] transition-colors border-none bg-transparent"
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold"
              style={{ background: `${meta.color}15`, color: meta.color }}
            >
              {(user?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)] hidden sm:inline max-w-[80px] truncate">
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown size={11} className="text-[var(--color-on-surface-variant)]" />
          </button>

          {/* Profile dropdown */}
          {showProfile && (
            <div className="absolute top-10 right-0 w-[200px] rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1 z-[100] shadow-floating">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-[var(--color-outline-variant)] mb-1">
                <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface)] truncate">{user?.name || 'User'}</p>
                <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)] truncate mt-0.5">{user?.email || ''}</p>
              </div>

              <button
                onClick={() => { setShowProfile(false); setChangePasswordOpen(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer bg-transparent border-none text-left hover:bg-[var(--color-surface-high)] transition-colors"
              >
                <KeyRound size={13} className="text-[var(--color-on-surface-variant)]" />
                <span className="text-[12px] font-medium text-[var(--color-on-surface)]">Change Password</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer bg-transparent border-none text-left hover:bg-[var(--color-error-muted)] transition-colors"
              >
                <LogOut size={13} className="text-[var(--color-error)]" />
                <span className="text-[12px] font-medium text-[var(--color-error)]">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </header>
  )
}
