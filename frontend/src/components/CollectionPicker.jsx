/**
 * CollectionPicker (F3b-2b) — „In Sammlung" für ein Rezept oder einen Beitrag.
 *
 * Zeigt die eigenen Sammlungen zur Auswahl und legt bei Bedarf direkt eine
 * neue an (dieselbe `CollectionFormModal` wie im Profil), die das Item dann
 * sofort aufnimmt.
 *
 * Doppeltes Hinzufügen ist serverseitig kein Fehler: die API antwortet auch
 * beim zweiten Mal mit 201 und derselben `CollectionSummary`. Ob wirklich
 * etwas dazukam, verrät nur `item_count` — genau daran unterscheiden wir
 * „hinzugefügt" von „ist schon drin", statt einen Statuscode zu deuten.
 */
import { useCallback, useEffect, useState } from 'react'

import { addCollectionItem, getCollections } from '../api/collections'
import CollectionFormModal from './CollectionFormModal'
import { Button } from './ui'

const SICHTBARKEIT_LABEL = { private: 'Privat', public: 'Öffentlich', unlisted: 'Über Link' }

export default function CollectionPicker({ itemType, itemId, onClose }) {
  const [sammlungen, setSammlungen] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState(false)
  const [neueOffen, setNeueOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(null)     // id der Sammlung, die gerade schreibt
  const [ergebnis, setErgebnis] = useState(null) // { text }

  const laden = useCallback((signal) => {
    return getCollections({ signal })
      .then(daten => setSammlungen(daten || []))
      .catch(err => { if (err.name !== 'CanceledError') setFehler(true) })
      .finally(() => setLaedt(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    laden(controller.signal)
    return () => controller.abort()
  }, [laden])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  // Nach der Rückmeldung von selbst schließen — der Nutzer hat hier nichts
  // mehr zu entscheiden.
  useEffect(() => {
    if (!ergebnis) return undefined
    const t = setTimeout(onClose, 1400)
    return () => clearTimeout(t)
  }, [ergebnis, onClose])

  const hinzufuegen = async sammlung => {
    setLaeuft(sammlung.id)
    try {
      const danach = await addCollectionItem(sammlung.id, { itemType, itemId })
      setErgebnis({
        text: danach.item_count > sammlung.item_count
          ? `Zu „${sammlung.name}" hinzugefügt.`
          : `Ist bereits in „${sammlung.name}".`,
      })
    } catch {
      setErgebnis({ text: 'Konnte nicht hinzugefügt werden. Bitte versuch es erneut.' })
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="In Sammlung legen"
        style={{ position: 'fixed', inset: 0, zIndex: 750, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div onClick={e => e.stopPropagation()}
          style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', padding: '1.5rem', maxWidth: 420, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
          <h2 style={{ margin: '0 0 1rem', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
            In Sammlung legen
          </h2>

          {ergebnis ? (
            <p style={{ margin: '0 0 .25rem', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)' }}>
              <i className="ti ti-check" aria-hidden="true" style={{ fontSize: 16, color: 'var(--green)' }} />
              {ergebnis.text}
            </p>
          ) : (
            <>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -.25rem' }}>
                {laedt && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="skeleton-block" style={{ height: 46, borderRadius: 'var(--radius-card)' }} />
                    ))}
                  </div>
                )}

                {!laedt && fehler && (
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--danger)' }}>
                    Deine Sammlungen konnten nicht geladen werden.
                  </p>
                )}

                {!laedt && !fehler && sammlungen.length === 0 && (
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
                    Du hast noch keine Sammlung. Leg unten eine an.
                  </p>
                )}

                {!laedt && !fehler && sammlungen.map(s => (
                  <button
                    key={s.id}
                    onClick={() => hinzufuegen(s)}
                    disabled={laeuft !== null}
                    data-track-id="collection-picker-select"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '.7rem .75rem', marginBottom: 6, textAlign: 'left',
                      background: 'none', border: '1px solid var(--hairline)',
                      borderRadius: 'var(--radius-card)',
                      cursor: laeuft !== null ? 'default' : 'pointer',
                      opacity: laeuft !== null && laeuft !== s.id ? 0.5 : 1,
                    }}
                  >
                    <i className="ti ti-books" aria-hidden="true" style={{ fontSize: 17, color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </span>
                      <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {SICHTBARKEIT_LABEL[s.visibility] || s.visibility} · {s.item_count}
                      </span>
                    </span>
                    {laeuft === s.id && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>…</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <Button variant="secondary" size="sm" trackId="collection-picker-create-open"
                  onClick={() => setNeueOffen(true)}
                  leftIcon={<i className="ti ti-plus" aria-hidden="true" />}>
                  Neue Sammlung
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose} trackId="collection-picker-cancel">
                  Abbrechen
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {neueOffen && (
        <CollectionFormModal
          onClose={() => setNeueOffen(false)}
          onCreated={angelegt => {
            setNeueOffen(false)
            // Frisch angelegt heißt leer — das Item kann nur neu dazukommen.
            setSammlungen(vorher => [...vorher, angelegt])
            hinzufuegen(angelegt)
          }}
        />
      )}
    </>
  )
}
