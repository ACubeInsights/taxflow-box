import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { setAuthToken, authApi } from '../services/api.js'

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
  const [loginLoading, setLoginLoading] = useState(false)
  const refreshTimerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const inactivityIntervalRef = useRef(null)

  const logout = useCallback(async () => {
    // Best-effort server logout
    if (token) {
      try { await authApi.logout() } catch { /* ignore */ }
    }
    setUser(null)
    setToken(null)
    setTokenExpiresAt(null)
    setTokenError(null)
    setSessionWarning(false)
    setLoginLoading(false)
    setAuthToken(null)
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    if (inactivityIntervalRef.current) {
      clearInterval(inactivityIntervalRef.current)
      inactivityIntervalRef.current = null
    }
  }, [token])

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

    const onUnauthorized = () => logout()
    window.addEventListener('auth-unauthorized', onUnauthorized)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler))
      window.removeEventListener('auth-unauthorized', onUnauthorized)
    }
  }, [user, resetActivity, logout])

  // Inactivity check interval
  useEffect(() => {
    if (!user) return

    lastActivityRef.current = Date.now()

    inactivityIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current

      if (elapsed >= SESSION_TIMEOUT_MS) {
        logout()
      } else if (elapsed >= SESSION_WARNING_MS) {
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

  // Schedule session refresh 5 minutes before expiry
  useEffect(() => {
    if (!token || !tokenExpiresAt) return

    const now = Date.now()
    const expiresMs = new Date(tokenExpiresAt).getTime()
    const refreshIn = expiresMs - now - 5 * 60 * 1000

    if (refreshIn <= 0) return

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const result = await authApi.refreshSession()
        setTokenExpiresAt(result.expiresAt)
      } catch {
        // Refresh failed — session will expire naturally
      }
    }, refreshIn)

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [token, tokenExpiresAt])

  /**
   * Login as client (email only) or staff (email + password).
   * @param {'client'|'staff'} loginType
   * @param {string} email
   * @param {string} password
   */
  const login = async (email, password) => {
    setTransitioning(true)
    setLoginLoading(true)
    setTokenError(null)

    try {
      const result = await authApi.login(email, password)

      setToken(result.sessionToken)
      setTokenExpiresAt(result.expiresAt)
      setAuthToken(result.sessionToken)
      setUser(result.user)
      lastActivityRef.current = Date.now()
    } catch (err) {
      setTokenError(err.message || 'Login failed')
      throw err
    } finally {
      setLoginLoading(false)
      setTransitioning(false)
    }
  }

  /**
   * Demo login — quick access for development.
   * @param {string} role
   */
  const demoLogin = (role) => {
    setTransitioning(true)
    setTokenError(null)

    setTimeout(() => {
      try {
        const mockToken = `mock-token-${role}-${Date.now()}`
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        setUser({ id: `demo-${role}`, email: `${role}@demo.taxflow`, name: `Demo ${role}`, role })
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
      login, demoLogin, logout, transitioning, loginLoading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
