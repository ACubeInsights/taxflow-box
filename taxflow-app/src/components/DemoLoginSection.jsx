import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Users, FileText, ChevronDown } from 'lucide-react'

const DEMO_ROLES = [
  { id: 'superadmin', label: 'Super Admin', description: 'Full system access', icon: Shield, color: '#818cf8' },
  { id: 'employee', label: 'Tax Preparer', description: 'Client workflows', icon: FileText, color: '#c4b5fd' },
  { id: 'client', label: 'Client', description: 'Portal view', icon: Users, color: '#5eead4' },
]

export default function DemoLoginSection({ demoLogin, isMobile }) {
  const [showDemo, setShowDemo] = useState(false)

  return (
    <>
      {/* Divider with toggle */}
      <div className="flex items-center gap-3 mt-8 mb-4">
        <div className="flex-1 h-[1px] bg-[var(--color-outline-variant)]" />
        <button
          type="button"
          onClick={() => setShowDemo(!showDemo)}
          className="flex items-center gap-1.5 bg-transparent border-none text-[11px] text-[var(--color-on-surface-variant)] font-semibold tracking-wide uppercase cursor-pointer hover:text-[var(--color-on-surface)] transition-colors p-0"
        >
          Demo Access
          <ChevronDown
            size={12}
            className="transition-transform duration-200"
            style={{ transform: showDemo ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
        <div className="flex-1 h-[1px] bg-[var(--color-outline-variant)]" />
      </div>

      {/* Demo role buttons */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              {DEMO_ROLES.map((role, i) => {
                const Icon = role.icon
                return (
                  <motion.button
                    key={role.id}
                    type="button"
                    onClick={() => demoLogin(role.id)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl cursor-pointer border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-outline)] transition-all duration-200 group"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-shadow duration-200 group-hover:shadow-[0_0_12px_var(--tw-shadow-color)]"
                      style={{
                        background: `${role.color}12`,
                        border: `1px solid ${role.color}25`,
                        '--tw-shadow-color': `${role.color}30`,
                      }}
                    >
                      <Icon size={14} color={role.color} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--color-on-surface)] leading-tight">
                        {role.label}
                      </span>
                      <span className="block text-[11px] text-[var(--color-on-surface-variant)] mt-0.5">
                        {role.description}
                      </span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
