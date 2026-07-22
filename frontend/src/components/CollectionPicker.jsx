/**
 * CollectionPicker (F3b-2b) — „In Sammlung" für ein Rezept oder einen Beitrag.
 *
 * Zeigt die eigenen Sammlungen zur Auswahl und legt bei Bedarf direkt eine
 * neue an (dieselbe `CollectionFormModal` wie im Profil), die das Item dann
 * sofort aufnimmt.
 *
 * Jede Zeile ist ein Umschalter (BUG-20): ein Häkchen zeigt, dass das Item
 * schon drinliegt, ein Tap nimmt es wieder heraus. Woher das Häkchen kommt,
 * sagt der Server — `getCollections` liefert mit Item-Kontext je Sammlung ein
 * `contains`. Der Picker bleibt dabei offen, damit man mehrere Sammlungen
 * hintereinander bedienen kann.
 *
 * `embedded` rendert nur den Körper, ohne eigenes Fullscreen-Overlay: für das
 * Bottom-Sheet im `PostOverlay`, das schon ein Dialog ist. Escape und
 * Body-Scroll gehören dort dem Overlay, das sie gestaffelt behandelt (erst
 * Sheet, dann Overlay) — der Picker mischt sich deshalb nicht ein. Der Körper
 * erwartet einen Flex-Spalten-Container mit begrenzter Höhe.
 *
 * `collections` ist ein Startwert aus dem Cache des Aufrufers (siehe
 * `CollectionSheetContext`): damit klappt das Sheet gefüllt auf statt erst mit
 * Skeletons. Die Häkchen hängen am Item und stehen im Cache nicht drin — der
 * Picker lädt deshalb trotzdem, nur eben still im Hintergrund.
 */
import { useCallback, useEffect, useState } from 'react'

import { addCollectionItem, getCollections, removeCollectionItem } from '../api/collections'
import CollectionFormModal from './CollectionFormModal'
import { Button } from './ui'

const SICHTBARKEIT_LABEL = { private: 'Privat', public: 'Öffentlich', unlisted: 'Über Link' }

export default function CollectionPicker({ itemType, itemId, onClose, embedded = false, collections = null }) {
  const [sammlungen, setSammlungen] = useState(collections || [])
  const [laedt, setLaedt] = useState(!collections)
  const [fehler, setFehler] = useState(false)
  const [neueOffen, setNeueOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(null)     // id der Sammlung, die gerade schreibt
  const [ergebnis, setErgebnis] = useState(null) // { text }

  const laden = useCallback((signal) => {
    return getCollections({ itemType, itemId, signal })
      .then(daten => setSammlungen(daten || []))
      .catch(err => { if (err.name !== 'CanceledError') setFehler(true) })
      .finally(() => setLaedt(false))
  }, [itemType, itemId])

  // Immer laden — der Startwert aus dem Cache kennt die Häkchen nicht. Mit
  // Startwert läuft es still im Hintergrund (kein `laedt`), ohne mit Skeletons.
  useEffect(() => {
    const controller = new AbortController()
    laden(controller.signal)
    return () => controller.abort()
  }, [laden])

  useEffect(() => {
    if (embedded) return undefined
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, embedded])

  useEffect(() => {
    if (embedded) return undefined
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [embedded])

  // Die Rückmeldung verschwindet von selbst. Geschlossen wird *nicht* mehr
  // automatisch: seit die Zeilen Umschalter sind, will man ggf. mehrere
  // nacheinander bedienen (BUG-20).
  useEffect(() => {
    if (!ergebnis) return undefined
    const t = setTimeout(() => setErgebnis(null), 2200)
    return () => clearTimeout(t)
  }, [ergebnis])

  // Zeile lokal fortschreiben statt neu zu laden — der Zähler und das Häkchen
  // sollen sofort stimmen.
  const zeileSetzen = (id, patch) => {
    setSammlungen(vorher => vorher.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const umschalten = async sammlung => {
    setLaeuft(sammlung.id)
    try {
      if (sammlung.contains) {
        await removeCollectionItem(sammlung.id, { itemType, itemId })
        zeileSetzen(sammlung.id, { contains: false, item_count: Math.max(0, sammlung.item_count - 1) })
        setErgebnis({ text: `Aus „${sammlung.name}" entfernt.` })
      } else {
        const danach = await addCollectionItem(sammlung.id, { itemType, itemId })
        zeileSetzen(sammlung.id, { contains: true, item_count: danach.item_count })
        setErgebnis({ text: `Zu „${sammlung.name}" hinzugefügt.` })
      }
    } catch {
      setErgebnis({ text: 'Hat nicht geklappt. Bitte versuch es erneut.', fehler: true })
    } finally {
      setLaeuft(null)
    }
  }

  // Der Körper ohne Rahmen — im Fullscreen-Pfad steckt er im Dialog-Panel, im
  // eingebetteten Pfad im Bottom-Sheet des Aufrufers.
  const koerper = (
    <>
      <h2 style={{ margin: '0 0 1rem', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
        In Sammlung legen
      </h2>

      {/* Status über der Liste statt an ihrer Stelle — die Liste bleibt
          bedienbar, während die Rückmeldung steht. */}
      {ergebnis && (
        <p style={{ margin: '0 0 .625rem', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: ergebnis.fehler ? 'var(--danger)' : 'var(--text)' }}>
          <i className={`ti ${ergebnis.fehler ? 'ti-alert-triangle' : 'ti-check'}`} aria-hidden="true" style={{ fontSize: 15, color: ergebnis.fehler ? 'var(--danger)' : 'var(--green)', flexShrink: 0 }} />
          {ergebnis.text}
        </p>
      )}

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

            {!laedt && !fehler && sammlungen.map(s => {
              const drin = !!s.contains
              return (
                <button
                  key={s.id}
                  onClick={() => umschalten(s)}
                  disabled={laeuft !== null}
                  aria-pressed={drin}
                  data-track-id="collection-picker-select"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '.7rem .75rem', marginBottom: 6, textAlign: 'left',
                    background: drin ? 'color-mix(in srgb, var(--green) 8%, transparent)' : 'none',
                    border: `1px solid ${drin ? 'color-mix(in srgb, var(--green) 45%, transparent)' : 'var(--hairline)'}`,
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
                  {laeuft === s.id ? (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>…</span>
                  ) : (
                    // Häkchen = liegt drin, Tap nimmt es wieder heraus.
                    <span
                      aria-hidden="true"
                      style={{
                        width: 21, height: 21, flexShrink: 0, borderRadius: 5,
                        border: drin ? 'none' : '1.5px solid var(--border-input)',
                        background: drin ? 'var(--green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {drin && <i className="ti ti-check" style={{ fontSize: 13, color: 'var(--on-accent)' }} />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <Button variant="secondary" size="sm" trackId="collection-picker-create-open"
              onClick={() => setNeueOffen(true)}
              leftIcon={<i className="ti ti-plus" aria-hidden="true" />}>
              Neue Sammlung
            </Button>
            {/* „Fertig" statt „Abbrechen": Umschalten wirkt sofort, es gibt
                nichts mehr zu bestätigen oder abzubrechen. */}
            <Button variant="ghost" size="sm" onClick={onClose} trackId="collection-picker-cancel">
              Fertig
            </Button>
      </div>
    </>
  )

  // Das Anlege-Formular hängt in beiden Pfaden an derselben Stelle: es bringt
  // sein eigenes Overlay mit und liegt per zIndex über allem anderen.
  const neueSammlung = neueOffen && (
    <CollectionFormModal
      onClose={() => setNeueOffen(false)}
      onCreated={angelegt => {
        setNeueOffen(false)
        // Frisch angelegt heißt leer — das Item kann nur neu dazukommen.
        setSammlungen(vorher => [...vorher, { ...angelegt, contains: false }])
        umschalten({ ...angelegt, contains: false })
      }}
    />
  )

  if (embedded) {
    return (
      <>
        {koerper}
        {neueSammlung}
      </>
    )
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
          {koerper}
        </div>
      </div>

      {neueSammlung}
    </>
  )
}
