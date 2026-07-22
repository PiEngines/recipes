/**
 * BeetContext — das eigene Beet als geteilte Quelle.
 *
 * Die Zugehörigkeit einer Pflanze zum Beet wird an mehreren Stellen gebraucht:
 * das „+"/„✓" auf den Kacheln der Kräuterschule und der Gesamtliste, die
 * Beet-Seite selbst, der Kalender-Filter. Jede Fläche für sich laden zu lassen
 * hieße, dass sie nach einem Tap auseinanderlaufen — also einmal hier, nach dem
 * Muster von `FavoritesContext`.
 *
 * Gehalten wird die volle Liste (nicht nur die Slugs): `Garten` braucht sie
 * ohnehin mit Pflanzdatum und Phase, und zwei Ladewege für dieselben Daten
 * wären genau das Problem, das dieser Context löst. Die Beet-Aufgaben bleiben
 * draußen — anderer Endpunkt, andere Lebensdauer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { addToBeet, getMyBeet, removeFromBeet } from '../api/plants'
import { useAuth } from './AuthContext'

const BeetContext = createContext(null)

export function BeetProvider({ children }) {
  const { user } = useAuth()
  const eingeloggt = !!user

  const [beet, setBeet] = useState([])
  const [loading, setLoading] = useState(false)
  // Läuft für diesen Slug gerade ein Schreibvorgang? Verhindert Doppel-Taps.
  const laufendRef = useRef(new Set())

  const refresh = useCallback((signal) => {
    if (!eingeloggt) {
      setBeet([])
      return Promise.resolve()
    }
    setLoading(true)
    return getMyBeet(signal ? { signal } : {})
      .then(daten => setBeet(Array.isArray(daten) ? daten : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eingeloggt])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const slugs = useMemo(
    () => new Set(beet.map(e => e.plant_slug).filter(Boolean)),
    [beet],
  )

  /**
   * Pflanze aufnehmen. Optimistisch mit Platzhalter-Eintrag, damit das Badge
   * sofort umschlägt; die Antwort ersetzt ihn durch den echten Datensatz (mit
   * `user_plant_id` und Phase), den die Beet-Liste braucht.
   */
  const hinzufuegen = useCallback(async (slug, name) => {
    if (!slug || laufendRef.current.has(slug)) return
    laufendRef.current.add(slug)
    setBeet(vorher => (vorher.some(e => e.plant_slug === slug)
      ? vorher
      : [...vorher, { user_plant_id: `vorlaeufig:${slug}`, plant_slug: slug, deutscher_name: name || slug }]))
    try {
      const eintrag = await addToBeet(slug)
      setBeet(vorher => vorher.map(e => (e.plant_slug === slug ? { ...e, ...eintrag } : e)))
    } catch {
      setBeet(vorher => vorher.filter(e => e.plant_slug !== slug))
    } finally {
      laufendRef.current.delete(slug)
    }
  }, [])

  const entfernen = useCallback(async (slug) => {
    if (!slug || laufendRef.current.has(slug)) return
    laufendRef.current.add(slug)
    const vorherigerEintrag = beet.find(e => e.plant_slug === slug)
    setBeet(vorher => vorher.filter(e => e.plant_slug !== slug))
    try {
      await removeFromBeet(slug)
    } catch {
      // Zurückrollen — an derselben Stelle, damit die Liste nicht springt.
      if (vorherigerEintrag) setBeet(vorher => [...vorher, vorherigerEintrag])
    } finally {
      laufendRef.current.delete(slug)
    }
  }, [beet])

  const umschalten = useCallback((slug, name) => (
    slugs.has(slug) ? entfernen(slug) : hinzufuegen(slug, name)
  ), [slugs, entfernen, hinzufuegen])

  const wert = useMemo(
    () => ({ beet, slugs, loading, refresh, hinzufuegen, entfernen, umschalten }),
    [beet, slugs, loading, refresh, hinzufuegen, entfernen, umschalten],
  )

  return <BeetContext.Provider value={wert}>{children}</BeetContext.Provider>
}

export function useBeet() {
  return useContext(BeetContext)
}
