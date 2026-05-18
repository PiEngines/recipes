import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const NavigationContext = createContext(null)

const STATIC_LABELS = {
  '/': 'Alle Rezepte',
  '/profile': 'Mein Profil',
  '/admin': 'Admin-Bereich',
  '/admin/users': 'Benutzerverwaltung',
  '/admin/recipes': 'Rezeptverwaltung',
}

function getLabelForPath(path, dynamicLabels) {
  if (STATIC_LABELS[path]) return STATIC_LABELS[path]
  if (dynamicLabels[path]) return dynamicLabels[path]
  if (/^\/recipes\/\d+\/edit$/.test(path)) return 'Rezept bearbeiten'
  if (/^\/recipes\/\d+$/.test(path)) return dynamicLabels[path] || 'Rezept'
  return null
}

export function NavigationProvider({ children }) {
  const location = useLocation()
  const [previousRoute, setPreviousRoute] = useState(null)
  const stackRef = useRef([])       // { path, label }[]
  const prevPathRef = useRef(null)
  const dynamicLabelsRef = useRef({})
  const skipNextRef = useRef(false) // true when goBack triggered navigation

  const setDynamicLabel = (path, label) => {
    dynamicLabelsRef.current = { ...dynamicLabelsRef.current, [path]: label }
  }

  useEffect(() => {
    const currentPath = location.pathname

    if (!prevPathRef.current) {
      prevPathRef.current = currentPath
      return
    }

    if (prevPathRef.current === currentPath) return

    if (skipNextRef.current) {
      // Navigation was triggered by goBack — don't push, just sync state
      skipNextRef.current = false
      prevPathRef.current = currentPath
      const top = stackRef.current[stackRef.current.length - 1]
      setPreviousRoute(top || null)
      return
    }

    // Push previous path to history stack (deduplicate consecutive entries)
    const label = getLabelForPath(prevPathRef.current, dynamicLabelsRef.current)
    if (label) {
      const last = stackRef.current[stackRef.current.length - 1]
      if (!last || last.path !== prevPathRef.current) {
        stackRef.current = [...stackRef.current.slice(-9), { path: prevPathRef.current, label }]
      }
    }

    prevPathRef.current = currentPath
    const top = stackRef.current[stackRef.current.length - 1]
    setPreviousRoute(top || null)
  }, [location.pathname])

  const goBack = useCallback((navigate, fallback = '/') => {
    if (stackRef.current.length > 0) {
      const top = stackRef.current[stackRef.current.length - 1]
      stackRef.current = stackRef.current.slice(0, -1)
      skipNextRef.current = true
      setPreviousRoute(stackRef.current[stackRef.current.length - 1] || null)
      navigate(top.path)
    } else if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }, [])

  return (
    <NavigationContext.Provider value={{ previousRoute, setDynamicLabel, goBack }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
