import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  email_failed:       AlertCircle,
}

const DROPDOWN_VARIANTS = {
  hidden:  { opacity: 0, scale: 0.96, y: -6 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.96, y: -4,  transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
}

export default function TopNav() {
  const { user, logout, sessionWarning } = useAuth()
  const meta = ROLE_META[user?.role] || ROLE_META.employee

  const [notifications, setNotifications]     = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile]         = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const pollRef     = useRef(null)
  const profileRef  = useRef(null)
  const notifRef    = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length
  const isEmployee  = user?.role === 'employee'

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current  && !notifRef.current.contains(e.target))  setShowNotifications(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Poll notifications — employee only
  useEffect(() => {
    if (!user || !isEmployee) { setNotifications([]); return }

    const fetch = async () => {
      try {
        const data = await notificationApi.getNotifications(user?.id || 'employee-1')
        if (Array.isArray(data)) setNotifications(data)
      } catch { /* silent */ }
    }

    fetch()
    pollRef.current = setInterval(fetch, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [user, isEmployee])

  const handleLogout = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setShowProfile(false)
    logout()
  }

  return (
    <>
      <header className="h-14 border-b border-[var(--color-outline-variant)] flex items-center px-6 lg:px-8 gap-4 sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl">

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 shrink-0">
            <span className="text-[11px] font-bold text-[var(--color-primary)]">TF</span>
          </div>
          <span className="text-[14px] font-semibold text-[var(--color-on-surface)] tracking-tight font-display">
            TaxFlow Pro
          </span>
          <span
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
            style={{
              background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
              color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.color} 20%, transparent)`,
            }}
          >
            {meta.badgeLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">

          {/* Notifications — employee only */}
          {isEmployee && (
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setShowNotifications(p => !p); setShowProfile(false) }}
                className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-high)] transition-colors border-none bg-transparent cursor-pointer"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <Bell size={16} />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[9px] font-bold text-[var(--color-surface-lowest)] px-1 pointer-events-none"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    key="notif-dropdown"
                    variants={DROPDOWN_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute top-10 right-0 w-[320px] max-h-[360px] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1.5 z-[100] shadow-floating origin-top-right"
                    style={{ backdropFilter: 'blur(20px)' }}
                  >
                    <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] px-3 py-2 uppercase tracking-wider">
                      Notifications {unreadCount > 0 && `· ${unreadCount} unread`}
                    </p>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Bell size={22} className="text-[var(--color-on-surface-variant)] opacity-30" />
                        <p className="text-[12px] text-[var(--color-on-surface-variant)] opacity-50 m-0">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, 8).map((n, i) => {
                        const EventIcon = EVENT_TYPE_ICONS[n.eventType] || Bell
                        return (
                          <div
                            key={n.id || i}
                            className="flex gap-2.5 items-start p-2.5 rounded-lg transition-colors hover:bg-[var(--color-surface-high)] cursor-default"
                            style={{ background: n.read ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 4%, transparent)' }}
                          >
                            <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/15">
                              <EventIcon size={12} className="text-[var(--color-primary)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="m-0 text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-wide mb-0.5">
                                {n.eventType?.replace(/_/g, ' ')}
                              </p>
                              <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] leading-relaxed line-clamp-2">
                                {n.message}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => { setShowProfile(p => !p); setShowNotifications(false) }}
              className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-high)] transition-colors border-none bg-transparent"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                  color: meta.color,
                }}
              >
                {(user?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)] hidden sm:inline max-w-[80px] truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
              <motion.div
                animate={{ rotate: showProfile ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChevronDown size={11} className="text-[var(--color-on-surface-variant)]" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  key="profile-dropdown"
                  variants={DROPDOWN_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute top-10 right-0 w-[210px] rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1 z-[100] shadow-floating origin-top-right"
                  style={{ backdropFilter: 'blur(20px)' }}
                >
                  {/* User info */}
                  <div className="px-3 py-2.5 border-b border-[var(--color-outline-variant)] mb-1">
                    <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface)] truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)] truncate mt-0.5">
                      {user?.email || ''}
                    </p>
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer bg-transparent border-none text-left hover:bg-[var(--color-error-muted)] transition-colors group"
                  >
                    <LogOut size={13} className="text-[var(--color-error)]" />
                    <span className="text-[12px] font-medium text-[var(--color-error)]">Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Session warning banner */}
      <AnimatePresence>
        {sessionWarning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-14 z-40 overflow-hidden"
          >
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-warning-muted)] border-b border-[var(--color-warning)]/20 text-[var(--color-warning)]">
              <Clock size={13} className="shrink-0" />
              <span className="text-[12px] font-semibold">
                Your session expires in less than 5 minutes. Any activity will extend it automatically.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  )
}
