import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingNotifications, setPendingNotifications] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }

    client.get('/api/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await client.post('/api/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const me = await client.get('/api/auth/me')
    setUser(me.data)
    if (me.data.dark_mode_preference) {
      const pref = me.data.dark_mode_preference
      localStorage.setItem('theme', pref)
      document.documentElement.setAttribute('data-theme', pref)
      window.dispatchEvent(new CustomEvent('themechange', { detail: pref }))
    }
    if (data.notifications?.length) {
      setPendingNotifications(data.notifications)
    }
    return data.declined_shares || []
  }

  const clearPendingNotifications = () => setPendingNotifications([])

  const logout = async () => {
    try { await client.post('/api/auth/logout') } catch (_) { /* stateless */ }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setPendingNotifications([])
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, pendingNotifications, clearPendingNotifications }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
