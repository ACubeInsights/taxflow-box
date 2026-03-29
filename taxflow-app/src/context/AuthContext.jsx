import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { setAuthToken } from '../services/api.js'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [token, setToken] = useState(null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null)
  const [tokenError, setTokenError] = useState(null)
  const refreshTimerRef = useRef(null)

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
      } catch (err) {
        setTokenError(err.message || 'Failed to obtain token')
      } finally {
        setTransitioning(false)
      }
    }, 400)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setTokenExpiresAt(null)
    setTokenError(null)
    setAuthToken(null)
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, tokenExpiresAt, tokenError, login, logout, transitioning }}>
      {children}
    </AuthContext.Provider>
  )
}
