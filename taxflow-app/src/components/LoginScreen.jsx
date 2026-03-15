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
    accentColor: '#a78bfa',
    glowRgb: '167,139,250',
  },
  {
    id: 'cxo',
    label: 'CXO/Partner',
    description: 'Executive overview',
    icon: TrendingUp,
    accentColor: '#06b6d4',
    glowRgb: '6,182,212',
  },
  {
    id: 'employee',
    label: 'Employee/Tax Preparer',
    description: 'Client & AI workflow',
    icon: FileText,
    accentColor: '#34d399',
    glowRgb: '52,211,153',
  },
  {
    id: 'client',
    label: 'Client',
    description: 'Your tax portal',
    icon: Users,
    accentColor: '#fbbf24',
    glowRgb: '251,191,36',
  },
]

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hoveredRole, setHoveredRole] = useState(null)

  // Responsive: detect viewport below 768px for mobile layout
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
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <AnimatedBackground />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 1 }}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 448,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.045)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 28,
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05) inset,
              0 40px 100px rgba(0,0,0,0.7),
              0 0 80px rgba(6,182,212,0.08)
            `,
            padding: isMobile ? '24px 20px 20px' : '36px 40px 32px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top highlight line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: 1,
              background:
                'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), rgba(255,255,255,0.3), rgba(6,182,212,0.6), transparent)',
              borderRadius: 999,
            }}
          />

          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(6,182,212,0.22), rgba(99,102,241,0.18))',
                border: '1px solid rgba(6,182,212,0.35)',
                marginBottom: 14,
                boxShadow: '0 0 32px rgba(6,182,212,0.22)',
              }}
            >
              <Zap size={24} color="#06b6d4" strokeWidth={2.5} />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: '#fff',
                lineHeight: 1.1,
              }}
            >
              TaxFlow Pro
            </h1>
            <p
              style={{
                margin: '7px 0 0',
                fontSize: 11,
                color: 'rgba(255,255,255,0.32)',
                letterSpacing: '0.12em',
                fontWeight: 600,
              }}
            >
              POWERED BY BOX AI &nbsp;·&nbsp; US TAX PLATFORM
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(6,182,212,0.75)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  letterSpacing: '0.01em',
                  transition: 'color 0.18s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#06b6d4')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(6,182,212,0.75)')}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isFormEmpty}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: 14,
                background: isFormEmpty
                  ? 'linear-gradient(135deg, rgba(6,182,212,0.4), rgba(99,102,241,0.4))'
                  : 'linear-gradient(135deg, #06b6d4, #6366f1)',
                border: '1px solid rgba(6,182,212,0.4)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                cursor: isFormEmpty ? 'not-allowed' : 'pointer',
                opacity: isFormEmpty ? 0.5 : 1,
                boxShadow: '0 8px 28px rgba(6,182,212,0.3), 0 1px 0 rgba(255,255,255,0.1) inset',
                transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 14px 36px rgba(6,182,212,0.4), 0 1px 0 rgba(255,255,255,0.12) inset'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(6,182,212,0.3), 0 1px 0 rgba(255,255,255,0.1) inset'
              }}
            >
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              margin: '24px 0 20px',
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.22)',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              DEMO ACCESS
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Role buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10,
            }}
          >
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
                  style={{
                    background: isHovered
                      ? `rgba(${role.glowRgb},0.12)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isHovered ? `rgba(${role.glowRgb},0.35)` : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 14,
                    padding: '13px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: isHovered
                      ? `0 8px 28px rgba(${role.glowRgb},0.18)`
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 5,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: `rgba(${role.glowRgb},0.18)`,
                        border: `1px solid rgba(${role.glowRgb},0.28)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: isHovered ? `0 0 12px rgba(${role.glowRgb},0.3)` : 'none',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      <Icon size={13} color={role.accentColor} />
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isHovered ? '#fff' : 'rgba(255,255,255,0.8)',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2,
                        transition: 'color 0.18s',
                      }}
                    >
                      {role.label}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.3)',
                      fontWeight: 400,
                      paddingLeft: 36,
                      lineHeight: 1.3,
                    }}
                  >
                    {role.description}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 20,
            }}
          >
            <Lock size={10} color="rgba(255,255,255,0.18)" />
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: 'rgba(255,255,255,0.18)',
                letterSpacing: '0.04em',
                fontWeight: 500,
              }}
            >
              AES-256 ENCRYPTION &nbsp;·&nbsp; SOC 2 TYPE II &nbsp;·&nbsp; ZERO-KNOWLEDGE
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
