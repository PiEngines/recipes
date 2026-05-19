import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

function getEffectiveTheme(pref) {
  if (pref === 'system' || !pref) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function useTheme() {
  const { user } = useAuth()
  const userRef = useRef(user)
  const debounceRef = useRef(null)

  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem('theme') || 'light'
    return getEffectiveTheme(stored)
  })

  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Sync state when AuthContext dispatches a theme change (e.g. after login)
  useEffect(() => {
    const handler = (e) => setThemeState(e.detail)
    window.addEventListener('themechange', handler)
    return () => window.removeEventListener('themechange', handler)
  }, [])

  const toggle = useCallback(() => {
    setThemeState(t => {
      const next = t === 'light' ? 'dark' : 'light'
      if (userRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          client.patch('/api/users/me', { dark_mode_preference: next }).catch(() => {})
        }, 2000)
      }
      return next
    })
  }, [])

  const setTheme = useCallback((pref) => {
    if (!pref) return
    setThemeState(getEffectiveTheme(pref))
  }, [])

  return { theme, toggle, setTheme }
}
