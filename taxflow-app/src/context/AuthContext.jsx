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

const SESSION_STORAGE_KEY = 'taxflow_session'

function loadPersistedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Check if expired
    if (data.tokenExpiresAt && new Date(data.tokenExpiresAt) < new Date()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function persistSession(data) {
  try {
    if (data) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data))
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  // Restore session from sessionStorage on mount
  const persisted = loadPersistedSession()

  const [user, setUser] = useState(persisted?.user || null)
  const [transitioning, setTransitioning] = useState(false)
  const [token, setToken] = useState(persisted?.token || null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState(persisted?.tokenExpiresAt || null)
  const [tokenError, setTokenError] = useState(null)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const refreshTimerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const inactivityIntervalRef = useRef(null)

  // Set the auth token header on mount if we have a persisted session
  useEffect(() => {
    if (persisted?.token) {
      setAuthToken(persisted.token)
    }
  }, [])

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
    persistSession(null)
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
      const userData = {
        ...result.user,
        vault: result.vault || null,
        externalId: result.user.externalId || null,
      }
      setUser(userData)
      persistSession({ user: userData, token: result.sessionToken, tokenExpiresAt: result.expiresAt })
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
        const userData = { id: `demo-${role}`, email: `${role}@demo.taxflow`, name: `Demo ${role}`, role, vault: null, externalId: `demo-${role}` }

        setUser(userData)
        setToken(mockToken)
        setTokenExpiresAt(expiresAt)
        setAuthToken(mockToken)
        persistSession({ user: userData, token: mockToken, tokenExpiresAt: expiresAt })
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
