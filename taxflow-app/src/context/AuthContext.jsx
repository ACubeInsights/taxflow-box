import { useState, createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [transitioning, setTransitioning] = useState(false)

  const login = (role) => {
    setTransitioning(true)
    setTimeout(() => {
      setUser(role)
      setTransitioning(false)
    }, 400)
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, transitioning }}>
      {children}
    </AuthContext.Provider>
  )
}
