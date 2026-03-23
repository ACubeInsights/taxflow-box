import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Shield, TrendingUp, Users, FileText, Zap, Lock } from 'lucide-react'
import AnimatedBackground from './AnimatedBackground'
import FloatingLabel from './FloatingLabel'

const ROLES = [
  {
    id: 'superadmin',
    label: 'Super Admin',
    description: 'System management',
    icon: Shield,
    accentColor: 'var(--color-primary)',
  },
  {
    id: 'cxo',
    label: 'CXO/Partner',
    description: 'Executive overview',
    icon: TrendingUp,
    accentColor: 'var(--color-tertiary)',
  },
  {
    id: 'employee',
    label: 'Employee/Tax Preparer',
    description: 'Client & AI workflow',
    icon: FileText,
    accentColor: 'var(--color-secondary)',
  },
  {
    id: 'client',
    label: 'Client',
    description: 'Your tax portal',
    icon: Users,
    accentColor: 'var(--color-on-surface-variant)',
  },
]

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hoveredRole, setHoveredRole] = useState(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const isFormEmpty = email.trim() === '' && password.trim() === ''
  const isFormValid = email.trim() !== '' && password.trim() !== ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isFormValid) return
    login('employee')
  }

  return (
    <div className="relative w-screen h-screen flex items-center justify-center p-5 overflow-y-auto bg-[var(--color-surface-lowest)] font-sans">
      <AnimatedBackground />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 1 }}
        className="relative z-10 w-full max-w-[460px]"
      >
        <div className="rounded-[32px] bg-[var(--color-surface-container)]/40 backdrop-blur-[40px] border border-[var(--color-outline-variant)] relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]" style={{ padding: isMobile ? '32px 24px 24px' : '44px 44px 36px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.8)' }}>
          {/* Top highlight line */}
          <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-[var(--color-outline)] to-transparent opacity-50 rounded-full" />

          {/* Brand */}
          <div className="text-center mb-9">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] border border-[var(--color-primary)]/40 mb-5 shadow-[0_0_32px_var(--color-primary)]/30" style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.2), rgba(75,142,255,0.1))' }}>
              <Zap size={28} className="text-[var(--color-primary)]" strokeWidth={2.5} />
            </div>
            <h1 className="m-0 text-[32px] font-bold text-[var(--color-on-surface)] leading-tight tracking-[-0.04em] font-display">
              TaxFlow Pro
            </h1>
            <p className="mt-2 text-[10px] text-[var(--color-on-surface-variant)] tracking-[0.16em] font-bold uppercase">
              Powered by Box AI
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 mb-4">
              <FloatingLabel
                label="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              <FloatingLabel
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="flex justify-end mb-7">
              <button
                type="button"
                className="bg-transparent border-none text-[12px] font-semibold text-[var(--color-primary)] cursor-pointer p-0 tracking-wide hover:text-white transition-colors"
                style={{ color: 'color-mix(in srgb, var(--color-primary) 80%, transparent)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'white'}
                onMouseLeave={e => e.currentTarget.style.color = 'color-mix(in srgb, var(--color-primary) 80%, transparent)'}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isFormEmpty}
              className={`relative w-full py-4 rounded-xl text-[15px] font-bold tracking-tight text-[var(--color-surface-lowest)] transition-all duration-300 overflow-hidden group ${isFormEmpty ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface-high)] text-[var(--color-on-surface-variant)]' : 'cursor-pointer hover:-translate-y-[1px] hover:shadow-[0_16px_40px_var(--color-primary)]/40'}`}
              style={{
                background: isFormEmpty ? 'var(--color-surface-highest)' : 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))',
                boxShadow: isFormEmpty ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 30px rgba(173,198,255,0.25)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Sign In
              </span>
              {!isFormEmpty && (
                <div className="absolute inset-0 block h-full w-full animate-[primary-shimmer_3s_infinite_linear]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)' }} />
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--color-outline-variant)]" />
            <span className="text-[10px] text-[var(--color-on-surface-variant)] font-bold tracking-[0.14em] uppercase">
              Demo Access
            </span>
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--color-outline-variant)]" />
          </div>

          {/* Role buttons */}
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {ROLES.map((role) => {
              const Icon = role.icon
              const isHovered = hoveredRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => login(role.id)}
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

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 mt-8 opacity-60">
            <Lock size={12} className="text-[var(--color-on-surface-variant)]" />
            <p className="m-0 text-[9px] text-[var(--color-on-surface-variant)] tracking-[0.06em] font-semibold uppercase">
              AES-256 Encryption &nbsp;·&nbsp; SOC 2 Type II
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

