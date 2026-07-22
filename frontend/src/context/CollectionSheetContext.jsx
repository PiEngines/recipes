/**
 * CollectionSheetContext — das „In Sammlung legen"-Bottom-Sheet, einmal zentral.
 *
 * Das Sheet hing ursprünglich im `PostOverlay`. Seit BUG-05 löst es auch das
 * Favoriten-Herz aus, und das steckt in jeder Rezeptkarte — pro Karte ein Sheet
 * zu rendern wäre Unsinn. Also hängt es einmal am Wurzelbaum und wird von
 * überall über `useCollectionSheet()` geöffnet.
 *
 * Die Sammlungsliste wird gecacht: `vorladen()` holt sie einmal pro Sitzung, das
 * Sheet klappt dadurch gefüllt auf statt erst mit Skeletons. Ist der Cache beim
 * Öffnen noch leer, lädt der `CollectionPicker` wie gehabt selbst. Nach dem
 * Schließen wird im Hintergrund aufgefrischt, damit eine im Sheet angelegte
 * Sammlung beim nächsten Öffnen dabei ist.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { getCollections } from '../api/collections'
import CollectionPicker from '../components/CollectionPicker'

const CollectionSheetContext = createContext(null)

export function CollectionSheetProvider({ children }) {
  const [ziel, setZiel] = useState(null)             // { itemType, itemId } | null
  const [sammlungen, setSammlungen] = useState(null) // null = nicht geladen
  const [tick, setTick] = useState(0)
  // Einmal pro Sitzung reicht — jede Karte hat ein Herz, das sonst je einen
  // Abruf auslösen würde.
  const geladenRef = useRef(false)

  const [laden, setLaden] = useState(false)

  useEffect(() => {
    if (!laden) return undefined
    const controller = new AbortController()
    getCollections({ signal: controller.signal })
      .then(daten => setSammlungen(daten || []))
      .catch(() => {})
    return () => controller.abort()
  }, [laden, tick])

  const vorladen = useCallback(() => {
    if (geladenRef.current) return
    geladenRef.current = true
    setLaden(true)
  }, [])

  const oeffnen = useCallback((itemType, itemId) => {
    vorladen()
    setZiel({ itemType, itemId })
  }, [vorladen])

  const schliessen = useCallback(() => {
    setZiel(null)
    // Auffrischen, damit eine eben angelegte Sammlung beim nächsten Öffnen steht.
    setTick(t => t + 1)
  }, [])

  // Escape schließt das Sheet. Es liegt über allem anderen, also gehört ihm der
  // Tastendruck — Aufrufer mit eigenem Escape-Handler (PostOverlay) fragen
  // `istOffen` ab und halten sich zurück.
  useEffect(() => {
    if (!ziel) return undefined
    const onKey = e => { if (e.key === 'Escape') schliessen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ziel, schliessen])

  // Stabile Identität: an dem Wert hängt ein Effekt in *jedem* Herz — ohne
  // Memo liefe der bei jedem Provider-Render neu.
  const wert = useMemo(() => ({ oeffnen, vorladen, istOffen: !!ziel }), [oeffnen, vorladen, ziel])

  return (
    <CollectionSheetContext.Provider value={wert}>
      {children}

      {ziel && (
        <>
          <div
            onClick={schliessen}
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.45)' }}
          />
          <div
            className="sheet-enter"
            role="dialog"
            aria-modal="true"
            aria-label="In Sammlung legen"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1101,
              background: 'var(--surface)',
              borderTop: '1px solid var(--hairline)',
              borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
              boxShadow: '0 -12px 40px rgba(0,0,0,.35)',
              padding: '1.25rem 1rem calc(1rem + env(safe-area-inset-bottom))',
              maxHeight: '62vh',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              maxWidth: 560, margin: '0 auto', width: '100%', flex: 1,
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <CollectionPicker
                embedded
                collections={sammlungen}
                itemType={ziel.itemType}
                itemId={ziel.itemId}
                onClose={schliessen}
              />
            </div>
          </div>
        </>
      )}
    </CollectionSheetContext.Provider>
  )
}

export function useCollectionSheet() {
  return useContext(CollectionSheetContext)
}
