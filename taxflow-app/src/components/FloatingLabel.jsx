import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function FloatingLabel({ label, type, value, onChange, autoComplete }) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const lifted = focused || value.length > 0

  const borderColor = focused
    ? 'rgba(6,182,212,0.5)'
    : hovered
      ? 'rgba(6,182,212,0.28)'
      : 'rgba(255,255,255,0.09)'

  const boxShadow = focused
    ? '0 0 0 3px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
    : hovered
      ? '0 0 0 2px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
      : 'inset 0 1px 0 rgba(255,255,255,0.03)'

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <label
        style={{
          position: 'absolute',
          left: 16,
          top: lifted ? 9 : '50%',
          transform: lifted ? 'translateY(0) scale(0.75)' : 'translateY(-50%) scale(1)',
          transformOrigin: 'left top',
          color: focused ? 'rgba(6,182,212,0.85)' : 'rgba(255,255,255,0.32)',
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {label}
      </label>
      <input
        type={type === 'password' && showPass ? 'text' : type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          outline: 'none',
          color: '#fff',
          fontSize: 15,
          fontWeight: 400,
          padding: lifted ? '24px 44px 10px 16px' : '18px 44px 18px 16px',
          transition: 'all 0.22s',
          boxShadow,
        }}
      />
      {type === 'password' && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPass(p => !p)}
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.28)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.18s',
            zIndex: 2,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
        >
          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  )
}
