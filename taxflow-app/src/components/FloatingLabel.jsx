import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Folio form field — label above control (not floating), token-only styles.
 */
export default function FloatingLabel({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  name,
  required,
}) {
  const [showPass, setShowPass] = useState(false)
  const inputId = id || `fl-${(label || 'field').toLowerCase().replace(/\s+/g, '-')}`
  const isPassword = type === 'password'

  return (
    <div className="relative flex flex-col gap-[var(--space-2)]">
      <label htmlFor={inputId} className="label-caps m-0">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={isPassword && showPass ? 'text' : type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          className="folio-input"
          style={isPassword ? { paddingRight: 'var(--space-10)' } : undefined}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPass(p => !p)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="absolute right-[var(--space-3)] top-1/2 flex -translate-y-1/2 cursor-pointer items-center rounded-[var(--radius-chip)] border-none bg-transparent p-[var(--space-1)] text-[var(--color-whisper)] hover:text-[var(--color-ink)]"
          >
            {showPass ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  )
}
