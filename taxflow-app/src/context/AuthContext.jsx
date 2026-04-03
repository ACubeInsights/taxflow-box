import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { setAuthToken } from '../services/api.js'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

/** Session timeout constants */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000   // 30 minutes
const SESSION_WARNING_MS = 25 * 60 * 1000   // 25 minutes — show warning
const INACTIVITY_CHECK_MS = 60 * 1000       // check every 60 seconds

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [token, setToken] = useState(null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null)
  const [tokenError, setTokenError] = useState(null)
  const [sessionWarning, setSessionWarning] = useState(false)
  const refreshTimerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const inactivityIntervalRef = useRef(null)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setTokenExpiresAt(null)
    setTokenError(null)
    setSessionWarning(false)
    setAuthToken(null)
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    if (inactivityIntervalRef.current) {
      clearInterval(inactivityIntervalRef.current)
      inactivityIntervalRef.current = null
    }
  }, [])

  // Reset activity timestamp on user interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setSessionWarning(false)
  }, [])

  // Global event listeners for activity tracking
  useEffect(() => {
    if (!user) return

    const events = ['click', 'keydown', 'mousemove', 'touchstart']
    const handler = () => resetActivity()

    events.forEach((evt) => window.addEventListener(evt, handler, { passive: true }))

    // Listen for 401 unauthorized responses to trigger logout
    const onUnauthorized = () => logout()
    window.addEventListener('auth-unauthorized', onUnauthorized)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler))
      window.removeEventListener('auth-unauthorized', onUnauthorized)
    }
  }, [user, resetActivity, logout])

  // Inactivity check interval (every 60 seconds)
  useEffect(() => {
    if (!user) return

    lastActivityRef.current = Date.now()

    inactivityIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current

      if (elapsed >= SESSION_TIMEOUT_MS) {
        // 30 minutes of inactivity — logout
        logout()
      } else if (elapsed >= SESSION_WARNING_MS) {
        // 25 minutes — show warning
        setSessionWarning(true)
      }
    }, INACTIVITY_CHECK_MS)

    return () => {
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current)
        inactivityIntervalRef.current = null
      }
    }
  }, [user, logout])

  // Schedule token refresh 5 minutes before expiry
  useEffect(() => {
    if (!token || !tokenExpiresAt) return

    const now = Date.now()
    const expiresMs = new Date(tokenExpiresAt).getTime()
    const refreshIn = expiresMs - now - 5 * 60 * 1000 // 5 min before expiry

    if (refreshIn <= 0) return // already past refresh window

    refreshTimerRef.current = setTimeout(() => {
      // Generate a new mock token on refresh
      const newToken = `mock-token-${user}-${Date.now()}`
      const newExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      setToken(newToken)
      setTokenExpiresAt(newExpiry)
      setAuthToken(newToken)
    }, refreshIn)

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [token, tokenExpiresAt, user])

  const login = (role) => {
    setTransitioning(true)
    setTokenError(null)

    setTimeout(() => {
      try {
        // Set a mock token — backend doesn't enforce auth middleware yet
        const mockToken = `mock-token-${role}-${Date.now()}`
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

        setUser(role)
        setToken(mockToken)
        setTokenExpiresAt(expiresAt)
        setAuthToken(mockToken)
        lastActivityRef.current = Date.now()
      } catch (err) {
        setTokenError(err.message || 'Failed to obtain token')
      } finally {
        setTransitioning(false)
      }
    }, 400)
  }

  return (
    <AuthContext.Provider value={{
      user, token, tokenExpiresAt, tokenError, sessionWarning,
      login, logout, transitioning,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
