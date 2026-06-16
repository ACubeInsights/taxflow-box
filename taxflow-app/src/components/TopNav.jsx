import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { notificationApi } from '../services/api'
import { Bell, LogOut, Upload, AtSign, RotateCcw, FileText, AlertCircle, KeyRound, User, ChevronDown } from 'lucide-react'
import ChangePasswordModal from './ChangePasswordModal'

const EVENT_TYPE_ICONS = {
  document_uploaded: Upload,
  mention: AtSign,
  revision_requested: RotateCcw,
  request_published: FileText,
  email_failed: AlertCircle,
}

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: 'var(--color-primary)', badge: 'SYSTEM' },
  employee: { label: 'Tax Preparer', color: 'var(--color-secondary)', badge: 'PREPARER' },
  client: { label: 'Client Portal', color: 'var(--color-on-surface-variant)', badge: 'CLIENT' },
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

  const unreadCount = notifications.filter(n => !n.read).length
  const isEmployee = user?.role === 'employee'

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Poll notifications every 30 seconds — only for employee role
  useEffect(() => {
    if (!user || !isEmployee) {
      setNotifications([])
      return
    }

    const fetchNotifications = async () => {
      try {
        const data = await notificationApi.getNotifications(user?.id || 'employee-1')
        if (Array.isArray(data)) setNotifications(data)
      } catch (err) {
        console.warn('Notification poll failed:', err.message)
      }
    }

    fetchNotifications()
    pollRef.current = setInterval(fetchNotifications, 30000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [user, isEmployee])

  const handleLogout = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setShowProfile(false)
    logout()
  }

  return (
    <div className="h-[65px] glass-panel border-b border-[var(--color-outline-variant)] shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex items-center px-7 gap-4 sticky top-0 z-50">
      {/* Left: App name */}
      <div className="flex-1">
        <span className="text-[14px] font-bold text-[var(--color-on-surface)] tracking-tight">TaxFlow Pro</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">

        {/* Notification — employee role only */}
        {isEmployee && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-[#06b6d4] border-[1.5px] border-black flex items-center justify-center text-[8px] font-bold text-black px-[3px]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifications && (
              <div
                className="absolute top-11 right-0 w-[340px] max-h-[380px] overflow-y-auto rounded-[14px] bg-[var(--color-surface-container)]/90 backdrop-blur-2xl ring-1 ring-[var(--color-outline-variant)] p-2 z-[100]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.5)' }}
              >
                <p className="text-[11px] font-semibold text-[var(--color-on-surface-variant)] px-2.5 py-2 uppercase tracking-[0.06em]">
                  Notifications {unreadCount > 0 && `(${unreadCount})`}
                </p>
                {notifications.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-on-surface-variant)]/50 py-4 text-center">No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((n, i) => {
                    const EventIcon = EVENT_TYPE_ICONS[n.eventType] || Bell
                    return (
                      <div key={n.id || i} className="flex gap-2.5 items-start p-2.5 rounded-[10px] mb-0.5" style={{ background: n.read ? 'transparent' : 'rgba(6,182,212,0.05)' }}>
                        <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-[#06b6d4]/8 border border-[#06b6d4]/15">
                          <EventIcon size={13} className="text-[#06b6d4]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-[#06b6d4] uppercase">{n.eventType?.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-[var(--color-on-surface-variant)]/40 ml-auto">
                              {n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : ''}
                            </span>
                          </div>
                          <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] leading-[1.4]">{n.message}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Profile dropdown — merges avatar, change password, logout */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(prev => !prev)}
            className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-highest)]/60"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 30%, transparent), color-mix(in srgb, ${meta.color} 10%, transparent))`,
                color: meta.color,
              }}
            >
              {(user?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[12px] font-semibold text-[var(--color-on-surface-variant)] hidden sm:inline max-w-[100px] truncate">
              {user?.name || 'User'}
            </span>
            <ChevronDown size={12} className="text-[var(--color-on-surface-variant)]" />
          </button>

          {/* Dropdown menu */}
          {showProfile && (
            <div
              className="absolute top-11 right-0 w-[220px] rounded-[14px] bg-[var(--color-surface-container)]/95 backdrop-blur-2xl ring-1 ring-[var(--color-outline-variant)] p-1.5 z-[100]"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.5)' }}
            >
              {/* User info header */}
              <div className="px-3 py-2.5 mb-1 border-b border-[var(--color-outline-variant)]/50">
                <p className="m-0 text-[13px] font-bold text-[var(--color-on-surface)] truncate">{user?.name || 'User'}</p>
                <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] truncate mt-0.5">{user?.email || ''}</p>
              </div>

              {/* Change Password */}
              <button
                onClick={() => { setShowProfile(false); setChangePasswordOpen(true); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-200 bg-transparent border-none text-left hover:bg-[var(--color-surface-highest)]"
              >
                <KeyRound size={14} className="text-[var(--color-on-surface-variant)]" />
                <span className="text-[12px] font-semibold text-[var(--color-on-surface)]">Change Password</span>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-200 bg-transparent border-none text-left hover:bg-red-500/10"
              >
                <LogOut size={14} className="text-[#f87171]" />
                <span className="text-[12px] font-semibold text-[#f87171]">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal — centered via fixed inset-0 flex */}
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  )
}
