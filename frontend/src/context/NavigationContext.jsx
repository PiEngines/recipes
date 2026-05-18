import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  const prevPathRef = useRef(null)
  const dynamicLabelsRef = useRef({})

  const setDynamicLabel = (path, label) => {
    dynamicLabelsRef.current = { ...dynamicLabelsRef.current, [path]: label }
  }

  useEffect(() => {
    const currentPath = location.pathname
    if (prevPathRef.current && prevPathRef.current !== currentPath) {
      const label = getLabelForPath(prevPathRef.current, dynamicLabelsRef.current)
      if (label) setPreviousRoute({ path: prevPathRef.current, label })
    }
    prevPathRef.current = currentPath
  }, [location.pathname])

  return (
    <NavigationContext.Provider value={{ previousRoute, setDynamicLabel }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
