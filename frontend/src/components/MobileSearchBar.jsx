import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import useSheetDrag from '../hooks/useSheetDrag'

const HIDE_PATHS = ['/profile', '/admin', '/admin/users', '/admin/recipes']
const EDIT_NEW_RE = /^\/recipes\/(new|\d+\/edit)$/
const RECIPE_DETAIL_RE = /^\/recipes\/\d+$/

// Grüne Welt: dort sucht die Leiste Pflanzen statt Rezepte (BUG-49). Die
// Ergebnisse zeigt die Kräuterschule — sie filtert die volle Pflanzenliste
// bereits, seit BUG-49 über `?q=` statt über internen State. Das Rezept-Sheet
// mit „Zuletzt gesucht" bleibt in der grünen Welt aus (Ü20).
const PFLANZEN_RE = /^\/(garten|kraeuterschule|pflanzen)(\/|$)/
const PFLANZEN_ZIEL = '/kraeuterschule'

// Höhe der Bottom-Nav, über der die Leiste sitzt.
const NAV_HOEHE = 78

// Live-Treffer beim Tippen — kurze Vorschau im Sheet.
const LIVE_MAX = 6
const LIVE_DEBOUNCE = 250

// Zuletzt gesucht — lokal (kein Backend).
const HISTORY_KEY = 'recipe_search_history'
const HISTORY_MAX = 6
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}
function pushHistory(term) {
  const t = term.trim()
  if (!t) return loadHistory()
  const next = [t, ...loadHistory().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, HISTORY_MAX)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

function ScopePill({ active, onClick, icon, children }) {
  return (
    <span
      role="checkbox"
      aria-checked={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        borderRadius: 999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border-input)'}`,
        padding: '5px 12px', fontSize: 12,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--on-accent)' : 'var(--subtext)',
        cursor: 'pointer', fontFamily: 'var(--font-body)', userSelect: 'none',
        transition: 'all .15s',
      }}
    >
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

// Mono-Abschnittslabel im Such-Sheet.
function SheetLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 10px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{children}</span>
      {action}
    </div>
  )
}

export default function MobileSearchBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef(null)
  const barRef = useRef(null)

  const isHidden = HIDE_PATHS.includes(location.pathname)
    || EDIT_NEW_RE.test(location.pathname)
    || RECIPE_DETAIL_RE.test(location.pathname)
    || location.pathname.startsWith('/users/')

  const pflanzenModus = PFLANZEN_RE.test(location.pathname)
  const zielPfad = pflanzenModus ? PFLANZEN_ZIEL : '/recipes'

  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const scopeDesc = searchParams.get('scopeDesc') === '1'
  const scopeIng = searchParams.get('scopeIng') === '1'
  const scopeAuthor = searchParams.get('scopeAuthor') === '1'
  const hasSearch = Boolean(inputValue)
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState(loadHistory)

  // Das Such-Sheet (Ü20) hängt an einem eigenen State, nicht am Fokus: so
  // reisst ein Blur während des Ziehens am Griff das Sheet nicht weg. In der
  // grünen Welt bleibt es aus — dort sucht die Leiste Pflanzen.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetIn, setSheetIn] = useState(false)
  // Live-Treffer (Ü20, Commit 2): sobald Text im Feld steht, zeigt das Sheet
  // eine kurze Trefferliste statt „Zuletzt gesucht". Das Ergebnis trägt den
  // Suchbegriff mit — passt er nicht zum aktuellen Feld, läuft die Suche noch.
  const [live, setLive] = useState({ term: '', items: [] })
  // Höhe der Leiste messen, damit das Sheet exakt darüber sitzt (die Leiste
  // wächst mit den Scope-Pills).
  const [barH, setBarH] = useState(56)

  const pathnameRef = useRef(location.pathname)
  useEffect(() => { pathnameRef.current = location.pathname }, [location.pathname])
  const zielRef = useRef(zielPfad)
  useEffect(() => { zielRef.current = zielPfad }, [zielPfad])

  useEffect(() => {
    const el = barRef.current
    if (!el) return undefined
    const beobachter = new ResizeObserver(() => setBarH(el.offsetHeight || 56))
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  // Slide-in einen Frame nach dem Öffnen (sonst rendert der Browser gleich den
  // Endzustand und es gibt nichts zu animieren).
  useEffect(() => {
    if (!sheetOpen) return undefined
    const id = requestAnimationFrame(() => setSheetIn(true))
    return () => cancelAnimationFrame(id)
  }, [sheetOpen])

  // Debounced Live-Suche — nur solange das Sheet offen ist und Text im Feld
  // steht. AbortController wie beim Fratcher (Ü16), damit kein alter Lauf den
  // neuen überholt. Pflanzenmodus zeigt kein Sheet, greift also nicht.
  // Kein Fetch nötig, wenn das Sheet zu ist oder das Feld leer — der Render
  // zeigt dann ohnehin „Zuletzt gesucht".
  const term = inputValue.trim()
  useEffect(() => {
    if (!sheetOpen || pflanzenModus || !term) return undefined
    const controller = new AbortController()
    const t = setTimeout(() => {
      client.get('/api/recipes', { params: { search: term, page_size: LIVE_MAX }, signal: controller.signal })
        .then(({ data }) => setLive({ term, items: data.items || [] }))
        .catch(err => { if (err.name !== 'CanceledError') setLive({ term, items: [] }) })
    }, LIVE_DEBOUNCE)
    return () => { clearTimeout(t); controller.abort() }
  }, [term, sheetOpen, pflanzenModus])

  const schliesseSheet = () => {
    setSheetIn(false)
    setFocused(false)
    inputRef.current?.blur()
    // Nach unten rausschieben, dann abbauen.
    setTimeout(() => setSheetOpen(false), 200)
  }

  const openRecipe = (id) => {
    schliesseSheet()
    navigate(`/recipes/${id}`)
  }

  const sheetDrag = useSheetDrag({ onClose: schliesseSheet })

  const oeffneSheet = () => {
    if (pflanzenModus) return
    sheetDrag.reset()
    setSheetOpen(true)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      // Auf der Ergebnisseite den Parameter fortschreiben, sonst dorthin
      // navigieren — je nach Modus Rezepte oder Pflanzen.
      if (pathnameRef.current !== zielRef.current) {
        if (inputValue) navigate(`${zielRef.current}?q=${encodeURIComponent(inputValue)}`)
        return
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (inputValue) next.set('q', inputValue)
        else next.delete('q')
        next.delete('page')
        return next
      }, { replace: true })
    }, 400)
    return () => clearTimeout(t)
  }, [inputValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleScope = (key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set(key, '1')
        if (key === 'scopeAuthor') { next.delete('scopeDesc'); next.delete('scopeIng') }
        else next.delete('scopeAuthor')
      } else {
        next.delete(key)
      }
      next.delete('page')
      return next
    }, { replace: true })
  }

  const runSearch = (term) => {
    const t = term.trim()
    if (!t) return
    setHistory(pushHistory(t))
    setInputValue(t)
    schliesseSheet()
    navigate(`${zielPfad}?q=${encodeURIComponent(t)}`)
  }

  const clearHistory = () => {
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
    setHistory([])
  }

  if (isHidden) return null

  // Leiste ist breit, solange das Sheet offen ist oder etwas im Feld steht;
  // im Ruhezustand (unfokussiert und leer) klappt sie zur kompakten Pille.
  const barWide = focused || sheetOpen || hasSearch
  const sheetGezeigt = sheetOpen && !pflanzenModus

  return (
    <>
      {sheetGezeigt && (
        <>
          {/* Backdrop — Tippen daneben schließt. Die Leiste (z 97) liegt darüber
              und bleibt bedienbar. */}
          <div
            onClick={schliesseSheet}
            style={{
              position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(42,34,24,.28)',
              opacity: sheetIn && sheetDrag.dragY === 0 ? 1 : 0,
              transition: sheetDrag.dragging ? 'none' : 'opacity .2s ease',
            }}
          />
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: NAV_HOEHE + barH, zIndex: 96,
              maxWidth: 960, margin: '0 auto',
              maxHeight: '60vh', display: 'flex', flexDirection: 'column',
              background: 'var(--card)', borderRadius: '14px 14px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,.16)',
              transform: sheetIn ? `translateY(${sheetDrag.dragY}px)` : 'translateY(110%)',
              transition: sheetDrag.dragging ? 'none' : 'transform .22s cubic-bezier(.4,0,.2,1)',
            }}
          >
            {/* Ganzer Kopf = Drag-Close-Zone: Grabber + Titelzeile. Das Sheet
                hängt an `sheetOpen`, nicht am Fokus — ein Blur beim Ziehen tut
                ihm also nichts. */}
            <div
              {...sheetDrag.griffProps}
              style={{ ...sheetDrag.griffProps.style, flexShrink: 0, padding: '10px 16px 6px' }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-input)', margin: '0 auto 8px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Suche</span>
                <button
                  onClick={schliesseSheet}
                  aria-label="Suche schließen"
                  data-track-id="search-sheet-close"
                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,.06)', color: 'var(--subtext)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 18px' }}>
              {term ? (
                // Live-Treffer beim Tippen (Commit 2). Tap → Detail; Enter bleibt
                // „alle Treffer".
                <>
                  <SheetLabel>Treffer</SheetLabel>
                  {live.term !== term ? (
                    <p style={{ margin: '4px 2px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>Suche …</p>
                  ) : live.items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {live.items.map((r, i) => (
                        <button
                          key={r.id}
                          onClick={() => openRecipe(r.id)}
                          data-track-id="search-sheet-result"
                          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 2px', background: 'none', border: 'none', borderBottom: i === live.items.length - 1 ? 'none' : '1px solid var(--hairline)', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{
                            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                            background: r.primary_image ? `center/cover no-repeat url(${r.primary_image})` : 'var(--bg-alt)',
                          }} />
                          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                          <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '4px 2px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>Nichts gefunden.</p>
                  )}
                </>
              ) : history.length > 0 ? (
                <>
                  <SheetLabel action={
                    <button onClick={clearHistory} data-track-id="search-sheet-history-clear"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 10, color: 'var(--text-muted)' }}>
                      Löschen
                    </button>
                  }>Zuletzt gesucht</SheetLabel>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {history.map((eintrag, i) => (
                      <button
                        key={eintrag}
                        onClick={() => runSearch(eintrag)}
                        data-track-id="search-sheet-history"
                        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', background: 'none', border: 'none', borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--hairline)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <i className="ti ti-clock" style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>{eintrag}</span>
                        <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ margin: '4px 2px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
                  Tippe einen Begriff ein, um zu suchen.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div
        ref={barRef}
        className="mobile-search-bar"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: NAV_HOEHE, zIndex: 97,
          background: 'var(--card)',
          borderTop: '1px solid rgba(0,0,0,.07)',
          boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
        }}
      >
        {/* Die Pille dehnt sich per max-width mit dem Fokus; im Ruhezustand
            bleibt sie kompakt und zentriert. */}
        <div style={{ maxWidth: barWide ? 960 : 340, margin: '0 auto', padding: hasSearch ? '8px 12px 6px' : '8px 12px', transition: 'max-width .25s ease' }}>
          <div style={{ position: 'relative' }}>
            <i className="ti ti-search" aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="search"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onFocus={() => { setFocused(true); oeffneSheet() }}
              onBlur={() => setFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Enter' && inputValue.trim()) runSearch(inputValue)
                else if (e.key === 'Escape') schliesseSheet()
              }}
              placeholder={pflanzenModus ? 'Pflanze suchen …' : (barWide ? 'Rezepte suchen …' : 'Suchen')}
              data-track-id="search-input"
              style={{
                width: '100%', padding: '0.45rem 1rem 0.45rem 2.35rem',
                // In der grünen Welt trägt das Feld denselben Ton (BUG-49b) —
                // sonst neutral wie bisher.
                border: `1.5px solid ${focused
                  ? (pflanzenModus ? 'var(--green)' : 'var(--accent)')
                  : (pflanzenModus ? 'color-mix(in srgb, var(--green) 40%, var(--border-input))' : 'var(--border-input)')}`,
                borderRadius: 'var(--radius-pill)',
                background: pflanzenModus ? 'color-mix(in srgb, var(--green) 7%, var(--bg))' : 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.9rem', fontFamily: 'var(--font-body)',
                outline: 'none', transition: 'var(--transition)',
                boxShadow: focused
                  ? `0 0 0 3px color-mix(in srgb, ${pflanzenModus ? 'var(--green)' : 'var(--accent)'} 12%, transparent)`
                  : 'none',
              }}
            />
          </div>
          {/* Die Scope-Pills gehören zur Rezeptsuche (Beschreibung, Zutaten,
              Autor) — für Pflanzen gibt es sie nicht. */}
          {hasSearch && !pflanzenModus && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 6 }}>
              <ScopePill active={scopeDesc} onClick={() => toggleScope('scopeDesc', !scopeDesc)} icon="ti-search">
                Rezept
              </ScopePill>
              <ScopePill active={scopeIng} onClick={() => toggleScope('scopeIng', !scopeIng)} icon="ti-leaf">
                Zutaten
              </ScopePill>
              <ScopePill active={scopeAuthor} onClick={() => toggleScope('scopeAuthor', !scopeAuthor)} icon="ti-user">
                Autor
              </ScopePill>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
