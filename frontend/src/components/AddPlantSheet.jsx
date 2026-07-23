/**
 * AddPlantSheet — Pflanze ins eigene Beet aufnehmen, ohne die Seite zu
 * verlassen (BUG-46).
 *
 * Bewusst minimal: Pflanze suchen, antippen, fertig. **Kein Standort und keine
 * Menge** — Lead-Entscheidung, siehe ABWEICHUNGEN.md. Das Pflanzdatum ist
 * optional und wird nach dem Hinzufügen nachgereicht, damit der Hauptweg ein
 * einziger Tap bleibt.
 *
 * Die volle Pflanzenliste (279) kommt in einem Rutsch vom Server und wird
 * clientseitig gefiltert — dasselbe Muster wie in der Kräuterschule.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

import { getPlants, patchBeet } from '../api/plants'
import { useBeet } from '../context/BeetContext'
import useSheetDrag from '../hooks/useSheetDrag'
import { plantImageStyle, shortBotanical } from '../theme/plants'

// Nicht alle 279 Treffer rendern, solange nicht gesucht wird — die Liste im
// Sheet ist zum Finden da, nicht zum Blättern.
const MAX_TREFFER = 40

function heute() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function AddPlantSheet({ onClose, onAdded }) {
  // Beet-Zugehörigkeit und Schreibweg kommen aus dem Context, damit die
  // Quick-Add-Badges anderswo denselben Stand zeigen.
  const { slugs: imBeet, hinzufuegen } = useBeet()
  const [pflanzen, setPflanzen] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState(false)
  const [query, setQuery] = useState('')
  const [laeuft, setLaeuft] = useState(null)   // slug, der gerade schreibt
  const [ergebnis, setErgebnis] = useState(null) // { slug, name, text, fehler? }
  const eingabeRef = useRef(null)
  const drag = useSheetDrag({ onClose })

  useEffect(() => {
    const controller = new AbortController()
    getPlants({ signal: controller.signal })
      .then(daten => setPflanzen(Array.isArray(daten) ? daten : []))
      .catch(err => { if (err.name !== 'CanceledError') setFehler(true) })
      .finally(() => setLaedt(false))
    return () => controller.abort()
  }, [])

  useEffect(() => { eingabeRef.current?.focus() }, [])

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

  const gefiltert = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return pflanzen.slice(0, MAX_TREFFER)
    return pflanzen
      .filter(p =>
        p.deutscher_name?.toLowerCase().includes(term) ||
        p.botanischer_name?.toLowerCase().includes(term),
      )
      .slice(0, MAX_TREFFER)
  }, [pflanzen, query])

  const auswaehlen = async (pflanze) => {
    if (imBeet.has(pflanze.slug)) {
      setErgebnis({ slug: pflanze.slug, name: pflanze.deutscher_name, text: `„${pflanze.deutscher_name}" ist schon in deinem Beet.` })
      return
    }
    setLaeuft(pflanze.slug)
    try {
      await hinzufuegen(pflanze.slug, pflanze.deutscher_name)
      setErgebnis({ slug: pflanze.slug, name: pflanze.deutscher_name, text: `„${pflanze.deutscher_name}" ins Beet gelegt.` })
    } catch {
      setErgebnis({ text: 'Hat nicht geklappt. Bitte versuch es erneut.', fehler: true })
    } finally {
      setLaeuft(null)
    }
  }

  // Nachgereicht statt vorab abgefragt: wer das Datum nicht braucht, soll es
  // nicht wegklicken müssen.
  const datumSetzen = async (slug, wert) => {
    if (!wert) return
    try {
      await patchBeet(slug, wert)
      onAdded?.()
      setErgebnis(vorher => (vorher && vorher.slug === slug
        ? { ...vorher, text: `Pflanzdatum für „${vorher.name}" gesetzt.` }
        : vorher))
    } catch {
      setErgebnis({ text: 'Das Pflanzdatum konnte nicht gespeichert werden.', fehler: true })
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.45)' }}
      />
      <div
        className="sheet-enter"
        role="dialog"
        aria-modal="true"
        aria-label="Pflanze hinzufügen"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 901,
          background: 'var(--surface)',
          borderTop: '1px solid var(--hairline)',
          borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,.35)',
          padding: '0.5rem 1rem calc(1rem + env(safe-area-inset-bottom))',
          maxHeight: '78vh',
          display: 'flex', flexDirection: 'column',
          transform: `translateY(${drag.dragY}px)`,
          transition: drag.dragging ? 'none' : 'transform .22s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Ganzer Kopf als Ziehgriff (FR-Sheet-Drag) — runterziehen schließt. */}
          <div
            {...drag.griffProps}
            style={{ ...drag.griffProps.style, flexShrink: 0, paddingTop: 6, marginBottom: '1rem' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-input)', margin: '0 auto 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ flex: 1, margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
                Pflanze hinzufügen
              </h2>
              <button
                onClick={onClose}
                aria-label="Schließen"
                data-track-id="beet-add-sheet-close"
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', padding: '9px 12px', marginBottom: 12, flexShrink: 0 }}>
            <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={eingabeRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pflanze suchen — Kräuter, Gemüse, Obst…"
              data-track-id="beet-add-sheet-search"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Suche leeren"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
              >
                <i className="ti ti-x" style={{ fontSize: 13 }} />
              </button>
            )}
          </div>

          {ergebnis && (
            <div style={{ marginBottom: 10, flexShrink: 0 }}>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: ergebnis.fehler ? 'var(--danger)' : 'var(--text)' }}>
                <i className={`ti ${ergebnis.fehler ? 'ti-alert-triangle' : 'ti-check'}`} aria-hidden="true" style={{ fontSize: 15, color: ergebnis.fehler ? 'var(--danger)' : 'var(--green)', flexShrink: 0 }} />
                {ergebnis.text}
              </p>
              {/* Optionales Pflanzdatum — nur direkt nach dem Hinzufügen. */}
              {ergebnis.slug && !ergebnis.fehler && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
                  Gepflanzt am
                  <input
                    type="date"
                    max={heute()}
                    onChange={e => datumSetzen(ergebnis.slug, e.target.value)}
                    data-track-id="beet-add-sheet-planted-on"
                    style={{ border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px' }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' }}>optional</span>
                </label>
              )}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -.25rem' }}>
            {laedt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton-block" style={{ height: 52, borderRadius: 'var(--radius-card)' }} />
                ))}
              </div>
            )}

            {!laedt && fehler && (
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--danger)' }}>
                Die Pflanzenliste konnte nicht geladen werden.
              </p>
            )}

            {!laedt && !fehler && gefiltert.length === 0 && (
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
                Keine Pflanze gefunden für „{query.trim()}".
              </p>
            )}

            {!laedt && !fehler && gefiltert.map(p => {
              const drin = imBeet.has(p.slug)
              return (
                <button
                  key={p.slug}
                  onClick={() => auswaehlen(p)}
                  disabled={laeuft !== null}
                  data-track-id="beet-add-sheet-select"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '.5rem .75rem', marginBottom: 6, textAlign: 'left',
                    background: 'none', border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-card)',
                    cursor: laeuft !== null ? 'default' : 'pointer',
                    opacity: laeuft !== null && laeuft !== p.slug ? 0.5 : 1,
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-tile)', flexShrink: 0, ...plantImageStyle }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.deutscher_name}
                    </span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortBotanical(p.botanischer_name)}
                    </span>
                  </span>
                  {laeuft === p.slug ? (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>…</span>
                  ) : drin ? (
                    <i className="ti ti-check" aria-label="Schon im Beet" style={{ fontSize: 16, color: 'var(--green)', flexShrink: 0 }} />
                  ) : (
                    <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                </button>
              )
            })}

            {!laedt && !fehler && !query.trim() && pflanzen.length > MAX_TREFFER && (
              <p style={{ margin: '4px .75rem 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {pflanzen.length} Pflanzen — such nach einem Namen
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
