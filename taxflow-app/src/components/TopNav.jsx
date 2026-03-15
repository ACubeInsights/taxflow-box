import { useAuth } from '../context/AuthContext'
import { Bell, LogOut } from 'lucide-react'

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: '#a78bfa', badge: 'SYSTEM', badgeBg: 'rgba(167,139,250,0.12)', badgeColor: '#a78bfa' },
  cxo: { label: 'CXO / Partner', color: '#06b6d4', badge: 'EXECUTIVE', badgeBg: 'rgba(6,182,212,0.1)', badgeColor: '#06b6d4' },
  employee: { label: 'Tax Preparer', color: '#34d399', badge: 'PREPARER', badgeBg: 'rgba(52,211,153,0.1)', badgeColor: '#34d399' },
  client: { label: 'Client Portal', color: '#fbbf24', badge: 'CLIENT', badgeBg: 'rgba(251,191,36,0.1)', badgeColor: '#fbbf24' },
}

export default function TopNav() {
  const { user, logout } = useAuth()
  const meta = ROLE_META[user] || ROLE_META.employee

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div
      style={{
        height: 65,
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: date */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
          {dateStr}
        </div>
      </div>

      {/* Center: Box AI badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 14px',
          borderRadius: 999,
          background: 'rgba(6,182,212,0.08)',
          border: '1px solid rgba(6,182,212,0.18)',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#06b6d4',
            boxShadow: '0 0 8px rgba(6,182,212,0.8)',
          }}
          className="animate-pulse-glow"
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(6,182,212,0.9)', letterSpacing: '0.06em' }}>
          BOX AI CONNECTED
        </span>
      </div>

      {/* Right: actions */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {/* Role label */}
        <span style={{ fontSize: 12, fontWeight: 500, color: meta.color, marginRight: 4 }}>
          {meta.label}
        </span>

        {/* Role badge */}
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: meta.badgeBg,
            border: `1px solid ${meta.color}25`,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: meta.badgeColor, letterSpacing: '0.07em' }}>
            {meta.badge}
          </span>
        </div>

        {/* Notification */}
        <button
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
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${meta.color}35, ${meta.color}15)`,
            border: `1px solid ${meta.color}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: meta.color,
            cursor: 'pointer',
          }}
        >
          {meta.label.slice(0,2).toUpperCase()}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
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
