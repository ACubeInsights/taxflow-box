import { useAuth } from '../context/AuthContext'
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
        <button className="w-9 h-9 rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)] hover:text-white transition-colors relative group">
          <Bell size={15} className="group-hover:scale-110 transition-transform" />
          <span className="absolute top-[7px] right-[7px] w-2 h-2 rounded-full bg-[var(--color-primary)] border-[1.5px] border-[var(--color-surface-lowest)]" />
        </button>

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
          onClick={logout}
          className="w-9 h-9 rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-on-surface-variant)] hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab] hover:border-[#ffb4ab]/30 transition-colors"
          aria-label="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  )
}

