import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, TrendingUp, Users, FileText } from 'lucide-react'

const DEMO_ROLES = [
  { id: 'superadmin', label: 'Super Admin', description: 'System management', icon: Shield, accentColor: 'var(--color-primary)' },
  { id: 'cxo', label: 'CXO/Partner', description: 'Executive overview', icon: TrendingUp, accentColor: 'var(--color-tertiary)' },
  { id: 'employee', label: 'Employee/Tax Preparer', description: 'Client & AI workflow', icon: FileText, accentColor: 'var(--color-secondary)' },
  { id: 'client', label: 'Client', description: 'Your tax portal', icon: Users, accentColor: 'var(--color-on-surface-variant)' },
]

/**
 * DemoLoginSection — renders the demo access toggle and role selection buttons.
 *
 * @param {{ demoLogin: (roleId: string) => void, isMobile: boolean }} props
 */
export default function DemoLoginSection({ demoLogin, isMobile }) {
  const [showDemo, setShowDemo] = useState(false)
  const [hoveredRole, setHoveredRole] = useState(null)

  return (
    <>
      {/* Demo access toggle */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--color-outline-variant)]" />
        <button
          type="button"
          onClick={() => setShowDemo(!showDemo)}
          className="bg-transparent border-none text-[10px] text-[var(--color-on-surface-variant)] font-bold tracking-[0.14em] uppercase cursor-pointer hover:text-[var(--color-primary)] transition-colors p-0"
        >
          {showDemo ? 'Hide Demo' : 'Demo Access'}
        </button>
        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--color-outline-variant)]" />
      </div>

      {/* Demo role buttons */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {DEMO_ROLES.map((role) => {
                const Icon = role.icon
                const isHovered = hoveredRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => demoLogin(role.id)}
                    onMouseEnter={() => setHoveredRole(role.id)}
                    onMouseLeave={() => setHoveredRole(null)}
                    className="group text-left p-3.5 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden"
                    style={{
                      background: isHovered ? `color-mix(in srgb, ${role.accentColor} 12%, transparent)` : 'var(--color-surface-high)',
                      border: `1px solid ${isHovered ? `color-mix(in srgb, ${role.accentColor} 40%, transparent)` : 'var(--color-outline-variant)'}`,
                      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: isHovered ? `0 12px 30px color-mix(in srgb, ${role.accentColor} 20%, transparent)` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <div
                        className="w-8 h-8 rounded-[10px] flex flex-shrink-0 items-center justify-center border transition-shadow duration-300"
                        style={{
                          background: `color-mix(in srgb, ${role.accentColor} 15%, transparent)`,
                          borderColor: `color-mix(in srgb, ${role.accentColor} 30%, transparent)`,
                          boxShadow: isHovered ? `0 0 16px ${role.accentColor}` : 'none',
                        }}
                      >
                        <Icon size={16} color={role.accentColor} strokeWidth={2.5} />
                      </div>
                      <span
                        className="text-[13px] font-bold tracking-tight transition-colors duration-200"
                        style={{ color: isHovered ? 'white' : 'var(--color-on-surface)' }}
                      >
                        {role.label}
                      </span>
                    </div>
                    <p className="m-0 pl-11 text-[11px] font-medium text-[var(--color-on-surface-variant)] leading-relaxed">
                      {role.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
