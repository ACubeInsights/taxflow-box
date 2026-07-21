import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function FloatingLabel({ id, label, type, value, onChange, autoComplete, name }) {
  const [focused, setFocused] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const lifted = focused || value.length > 0
  const inputId = id || `fl-${label?.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="relative group">
      <label
        htmlFor={inputId}
        className="absolute left-4 pointer-events-none z-[2] font-medium transition-all duration-200 ease-out"
        style={{
          top: lifted ? '10px' : '50%',
          transform: lifted ? 'translateY(0) scale(0.72)' : 'translateY(-50%) scale(1)',
          transformOrigin: 'left top',
          color: focused
            ? 'var(--color-primary)'
            : 'var(--color-on-surface-variant)',
          fontSize: '14px',
          letterSpacing: '0.01em',
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type={type === 'password' && showPass ? 'text' : type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        className="w-full outline-none text-[var(--color-on-surface)] text-[15px] font-normal rounded-xl border transition-all duration-200"
        style={{
          background: 'var(--color-surface-high)',
          borderColor: focused
            ? 'rgba(129, 140, 248, 0.5)'
            : 'var(--color-outline-variant)',
          padding: lifted ? '26px 44px 10px 16px' : '18px 44px 18px 16px',
          boxShadow: focused
            ? '0 0 0 3px rgba(129, 140, 248, 0.08), 0 1px 2px rgba(0,0,0,0.2)'
            : '0 1px 2px rgba(0,0,0,0.1)',
        }}
      />
      {type === 'password' && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPass(p => !p)}
          aria-label={showPass ? 'Hide password' : 'Show password'}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-[var(--color-on-surface-variant)] cursor-pointer p-1 flex items-center rounded-md hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-highest)] z-[2]"
        >
          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  )
}
