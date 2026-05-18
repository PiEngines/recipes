import { useState, useEffect } from 'react'

function getEffectiveTheme(pref) {
  if (pref === 'system' || !pref) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem('theme') || 'light'
    return getEffectiveTheme(stored)
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))

  const setTheme = (pref) => {
    const effective = getEffectiveTheme(pref)
    setThemeState(effective)
  }

  return { theme, toggle, setTheme }
}
