import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { notificationApi } from '../services/api'
import { Bell, LogOut } from 'lucide-react'

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: 'var(--color-primary)', badge: 'SYSTEM' },
  cxo: { label: 'CXO / Partner', color: 'var(--color-tertiary)', badge: 'EXECUTIVE' },
  employee: { label: 'Tax Preparer', color: 'var(--color-secondary)', badge: 'PREPARER' },
  client: { label: 'Client Portal', color: 'var(--color-on-surface-variant)', badge: 'CLIENT' },
}

export default function TopNav() {
  const { user, logout } = useAuth()
  const meta = ROLE_META[user] || ROLE_META.employee
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const pollRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  // Poll notifications every 30 seconds when authenticated
  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }

    const fetchNotifications = async () => {
      try {
        const data = await notificationApi.getNotifications(user)
        if (Array.isArray(data)) {
          setNotifications(data)
        }
      } catch (err) {
        // Silent fail — notifications are non-critical
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
  }, [user])

  const handleLogout = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    logout()
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="h-[65px] glass-panel border-b border-[var(--color-outline-variant)] shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex items-center px-7 gap-4 sticky top-0 z-50">
      {/* Left: date */}
      <div className="flex-1">
        <div className="text-[12px] text-[var(--color-on-surface-variant)] font-medium tracking-wide">
          {dateStr}
        </div>
      </div>

      {/* Center: Box AI badge */}
      <div className="flex items-center gap-[7px] px-[14px] py-[6px] rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 shadow-[0_0_12px_var(--color-primary)]/10">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)] animate-pulse-glow" />
        <span className="text-[10px] font-bold text-[var(--color-primary)] tracking-widest uppercase mt-[1px]">
          BOX AI CONNECTED
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {/* Role label & badge */}
        <div className="flex items-center gap-2 mr-1">
          <span
            className="text-[12px] font-semibold tracking-tight"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
          <div
            className="px-2 py-[2px] rounded-md border"
            style={{
              background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
              borderColor: `color-mix(in srgb, ${meta.color} 25%, transparent)`
            }}
          >
            <span
              className="text-[9px] font-bold tracking-widest"
              style={{ color: meta.color }}
            >
              {meta.badge}
            </span>
          </div>
        </div>

        {/* Notification */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(prev => !prev)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              position: 'relative',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            }}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 999,
                  background: '#06b6d4',
                  border: '1.5px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 700,
                  color: '#000',
                  padding: '0 3px',
                }}
              >
                {unreadCount}
              </span>
            )}
            {unreadCount === 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#06b6d4',
                  border: '1.5px solid #000',
                }}
              />
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 320,
                maxHeight: 360,
                overflowY: 'auto',
                borderRadius: 14,
                background: 'rgba(15,15,20,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 100,
                padding: 8,
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </p>
              {notifications.length === 0 ? (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', padding: '16px 10px', textAlign: 'center' }}>No notifications</p>
              ) : (
                notifications.slice(0, 10).map((n, i) => (
                  <div
                    key={n.id || i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: n.read ? 'transparent' : 'rgba(6,182,212,0.05)',
                      marginBottom: 2,
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase' }}>{n.eventType}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                        {n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{n.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold cursor-pointer"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 30%, transparent), color-mix(in srgb, ${meta.color} 10%, transparent))`,
            borderColor: `color-mix(in srgb, ${meta.color} 40%, transparent)`,
            color: meta.color,
          }}
        >
          {meta.label.slice(0, 2).toUpperCase()}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            e.currentTarget.style.color = '#f87171'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
          }}
          aria-label="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  )
}

