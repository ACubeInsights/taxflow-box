import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, FileText, Settings, ChevronLeft,
  ChevronRight, Zap, BarChart2, FolderOpen, Bell, Shield,
  Briefcase, Upload, HelpCircle, LogOut, Bot
} from 'lucide-react'

const NAV_ITEMS = {
  superadmin: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'users', icon: Users, label: 'User Management' },
    { id: 'security', icon: Shield, label: 'Security & Audit' },
    { id: 'ai-status', icon: Bot, label: 'AI Insights' },
    { id: 'config', icon: Settings, label: 'System Config' },
  ],
  employee: [
    { id: 'workspace', icon: LayoutDashboard, label: 'My Workspace' },
    { id: 'clients', icon: Users, label: 'Clients' },
    { id: 'documents', icon: FolderOpen, label: 'Documents' },
    { id: 'ai-insights', icon: Bot, label: 'AI Insights' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ],
  client: [
    { id: 'portal', icon: LayoutDashboard, label: 'My Portal' },
    { id: 'my-documents', icon: FileText, label: 'My Documents' },
    { id: 'upload', icon: Upload, label: 'Upload Files' },
    { id: 'messages', icon: Bell, label: 'Messages' },
    { id: 'help', icon: HelpCircle, label: 'Help' },
  ],
}

const ROLE_META = {
  superadmin: { label: 'Super Admin', color: 'var(--color-primary)', initials: 'SA' },
  employee: { label: 'Tax Preparer', color: 'var(--color-secondary)', initials: 'TP' },
  client: { label: 'Client', color: 'var(--color-on-surface-variant)', initials: 'CL' },
}

export default function Sidebar({ collapsed, onToggle, activeView, onNavigate }) {
  const { user, logout } = useAuth()
  const items = NAV_ITEMS[user?.role] || NAV_ITEMS.employee
  const meta = ROLE_META[user?.role] || ROLE_META.employee

  return (
    <div
      className="fixed top-0 left-0 bottom-0 z-[100] flex flex-col overflow-hidden glass-panel border-r border-[var(--color-outline-variant)] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ width: collapsed ? 72 : 240 }}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 border-b border-[var(--color-outline-variant)] min-h-[65px] transition-all ${collapsed ? 'justify-center p-5' : 'justify-start px-5 py-5'}`}
      >
        <div
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 border border-[var(--color-primary)]/30 shadow-[0_0_16px_var(--color-primary)] shadow-[var(--color-primary)]/20"
          style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.2), rgba(75,142,255,0.1))' }}
        >
          <Zap size={16} className="text-[var(--color-primary)]" strokeWidth={2.5}/>
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex flex-col">
            <span className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap font-display">
              TaxFlow Pro
            </span>
            <span className="text-[9px] text-[var(--color-on-surface-variant)] tracking-widest font-bold uppercase mt-[1px]">
              TaxFlow Pro
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id || (activeView === 'default' && item === items[0])
          return (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                border: 'none',
                background: isActive
                  ? 'rgba(6,182,212,0.1)'
                  : 'transparent',
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'all 0.18s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              {isActive && (
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
                color={isActive ? '#06b6d4' : 'rgba(255,255,255,0.4)'}
                style={{ flexShrink: 0 }}
              />
              {!collapsed && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
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
        className={`border-t border-[var(--color-outline-variant)] flex items-center gap-3 transition-all ${collapsed ? 'justify-center py-4 px-0' : 'justify-start py-4 px-4'}`}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border"
          style={{
            background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}10)`,
            borderColor: `${meta.color}50`,
            color: meta.color,
          }}
        >
          {meta.initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[12px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                {user?.name || meta.label}
              </span>
              <span className="text-[10px] text-[var(--color-on-surface-variant)] font-medium">
                {user?.email || 'demo@taxflow.pro'}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-[6px] rounded-md text-[var(--color-on-surface-variant)] hover:text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute top-1/2 -right-3 transform -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface)] transition-all z-10 shadow-lg"
      >
        {collapsed ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
      </button>
    </div>
  )
}

