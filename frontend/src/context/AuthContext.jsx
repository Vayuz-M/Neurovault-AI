import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('nv_token'))
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    if (!token) { setLoading(false); return }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      localStorage.removeItem('nv_token')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchMe() }, [fetchMe])

  const login = async (email, password) => {
    const data = await authApi.login(email, password)
    localStorage.setItem('nv_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }

  const register = async (email, fullName, password) => {
    const data = await authApi.register(email, fullName, password)
    localStorage.setItem('nv_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }

  const logout = () => {
    localStorage.removeItem('nv_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
