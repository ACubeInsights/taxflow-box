import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, FileText, Settings, ChevronLeft,
  ChevronRight, Zap, BarChart2, FolderOpen, Bell, Shield,
  Briefcase, Upload, HelpCircle, LogOut, Bot
} from 'lucide-react'

const NAV_ITEMS = {
  superadmin: [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Users, label: 'User Management' },
    { icon: Shield, label: 'Security & Audit' },
    { icon: Bot, label: 'Box AI Status' },
    { icon: Settings, label: 'System Config' },
  ],
  cxo: [
    { icon: LayoutDashboard, label: 'Overview', active: true },
    { icon: BarChart2, label: 'Portfolio Analytics' },
    { icon: FileText, label: 'Compliance Reports' },
    { icon: Bell, label: 'Alerts & Deadlines' },
    { icon: Settings, label: 'Settings' },
  ],
  employee: [
    { icon: LayoutDashboard, label: 'My Workspace', active: true },
    { icon: Users, label: 'Clients' },
    { icon: FolderOpen, label: 'Documents' },
    { icon: Bot, label: 'AI Insights' },
    { icon: Bell, label: 'Notifications' },
    { icon: Settings, label: 'Settings' },
  ],
  client: [
    { icon: LayoutDashboard, label: 'My Portal', active: true },
    { icon: FileText, label: 'My Documents' },
    { icon: Upload, label: 'Upload Files' },
    { icon: Bell, label: 'Messages' },
    { icon: HelpCircle, label: 'Help' },
  ],
}

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: '#a78bfa', initials: 'SA' },
  cxo: { label: 'CXO / Partner', color: '#06b6d4', initials: 'CX' },
  employee: { label: 'Tax Preparer', color: '#34d399', initials: 'TP' },
  client: { label: 'Client', color: '#fbbf24', initials: 'CL' },
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const items = NAV_ITEMS[user] || NAV_ITEMS.employee
  const meta = ROLE_META[user] || ROLE_META.employee

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: collapsed ? 72 : 240,
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '20px 0' : '20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 65,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(99,102,241,0.25))',
            border: '1px solid rgba(6,182,212,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(6,182,212,0.15)',
          }}
        >
          <Zap size={16} color="#06b6d4" />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              TaxFlow Pro
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', fontWeight: 500 }}>
              BOX AI PLATFORM
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                border: 'none',
                background: item.active
                  ? 'rgba(6,182,212,0.1)'
                  : 'transparent',
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'all 0.18s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!item.active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={e => {
                if (!item.active) e.currentTarget.style.background = 'transparent'
              }}
            >
              {item.active && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: '#06b6d4',
                    boxShadow: '0 0 8px rgba(6,182,212,0.6)',
                  }}
                />
              )}
              <Icon
                size={17}
                color={item.active ? '#06b6d4' : 'rgba(255,255,255,0.4)'}
                style={{ flexShrink: 0 }}
              />
              {!collapsed && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: item.active ? 600 : 400,
                    color: item.active ? '#fff' : 'rgba(255,255,255,0.45)',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User profile */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: collapsed ? '12px 0' : '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}20)`,
            border: `1px solid ${meta.color}50`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: meta.color,
            flexShrink: 0,
          }}
        >
          {meta.initials}
        </div>
        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {meta.label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                demo@taxflow.pro
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            >
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          top: '50%',
          right: -12,
          transform: 'translateY(-50%)',
          width: 24,
          height: 24,
          borderRadius: 999,
          background: 'rgba(30,30,35,1)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(6,182,212,0.2)'
          e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'
          e.currentTarget.style.color = '#06b6d4'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(30,30,35,1)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  )
}
