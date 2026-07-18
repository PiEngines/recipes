import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { categoryGradient } from '../theme/categoryColors'

const HIDE_PATHS = ['/profile', '/admin', '/admin/users', '/admin/recipes']
const EDIT_NEW_RE = /^\/recipes\/(new|\d+\/edit)$/
const RECIPE_DETAIL_RE = /^\/recipes\/\d+$/

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

// „Beliebt" — kuratierte, redaktionelle Begriffe (STATISCH, kein Live-Popular-Backend).
const POPULAR = ['Bärlauch', 'Ofengemüse', 'Kürbissuppe', 'Spargel', 'Focaccia', 'Rhabarber']

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

// Mono-Abschnittslabel im Such-Fokus-Overlay.
function OverlayLabel({ children, action }) {
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

  const isHidden = HIDE_PATHS.includes(location.pathname)
    || EDIT_NEW_RE.test(location.pathname)
    || RECIPE_DETAIL_RE.test(location.pathname)
    || location.pathname.startsWith('/users/')

  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const scopeDesc = searchParams.get('scopeDesc') === '1'
  const scopeIng = searchParams.get('scopeIng') === '1'
  const scopeAuthor = searchParams.get('scopeAuthor') === '1'
  const hasSearch = Boolean(inputValue)
  const [focused, setFocused] = useState(false)

  // Such-Fokus-Overlay (②): sichtbar bei fokussiertem, leerem Feld.
  const overlayOpen = focused && !inputValue
  const [categories, setCategories] = useState([])
  const [history, setHistory] = useState(loadHistory)

  const pathnameRef = useRef(location.pathname)
  useEffect(() => { pathnameRef.current = location.pathname }, [location.pathname])

  // Kategorien lazy laden, sobald das Overlay erstmals geöffnet wird.
  useEffect(() => {
    if (overlayOpen && categories.length === 0) {
      client.get('/api/categories').then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => {})
    }
  }, [overlayOpen, categories.length])

  useEffect(() => {
    const t = setTimeout(() => {
      if (pathnameRef.current !== '/recipes') {
        if (inputValue) navigate(`/recipes?q=${encodeURIComponent(inputValue)}`)
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

  const dismiss = () => { setFocused(false); inputRef.current?.blur() }

  const runSearch = (term) => {
    const t = term.trim()
    if (!t) return
    setHistory(pushHistory(t))
    setInputValue(t)
    dismiss()
    navigate(`/recipes?q=${encodeURIComponent(t)}`)
  }

  const openCategory = (cat) => {
    dismiss()
    navigate(`/recipes?category=${cat.id}`)
  }

  const clearHistory = () => {
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
    setHistory([])
  }

  if (isHidden) return null

  return (
    <>
      {/* Such-Fokus-Overlay ② — verdeckt das Grid; Eingabe bleibt unten (Bar liegt darüber, z-97) */}
      {overlayOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'var(--bg)', overflowY: 'auto' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '76px 16px 156px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Suche</span>
              <button
                onMouseDown={e => { e.preventDefault(); dismiss() }}
                data-track-id="search-overlay-cancel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}
              >
                Abbrechen
              </button>
            </div>

            {/* Kategorien */}
            {categories.length > 0 && (
              <>
                <OverlayLabel action={
                  <button onMouseDown={e => { e.preventDefault(); dismiss(); navigate('/categories') }} data-track-id="search-overlay-all-categories"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10, color: 'var(--accent)' }}>
                    Alle Kategorien <i className="ti ti-chevron-right" style={{ fontSize: 12 }} />
                  </button>
                }>Kategorien</OverlayLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={e => { e.preventDefault(); openCategory(c) }}
                      data-track-id="search-overlay-category"
                      style={{ position: 'relative', height: 64, border: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,.1), 0 3px 0 0 var(--wood-shadow)', background: categoryGradient(c.name) }}
                    >
                      <div style={{ position: 'absolute', left: 10, bottom: 8 }}>
                        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--on-accent)', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{c.name}</p>
                        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,.75)' }}>{c.recipe_count} Rezepte</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Beliebt (statisch) */}
            <OverlayLabel>Beliebt</OverlayLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              {POPULAR.map(term => (
                <button
                  key={term}
                  onMouseDown={e => { e.preventDefault(); runSearch(term) }}
                  data-track-id="search-overlay-popular"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 16, padding: '7px 13px' }}
                >
                  <i className="ti ti-heart" style={{ fontSize: 12, color: 'var(--accent)' }} />
                  {term}
                </button>
              ))}
            </div>

            {/* Zuletzt gesucht (localStorage) */}
            {history.length > 0 && (
              <>
                <OverlayLabel action={
                  <button onMouseDown={e => { e.preventDefault(); clearHistory() }} data-track-id="search-overlay-history-clear"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 10, color: 'var(--text-muted)' }}>
                    Löschen
                  </button>
                }>Zuletzt gesucht</OverlayLabel>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {history.map((term, i) => (
                    <button
                      key={term}
                      onMouseDown={e => { e.preventDefault(); runSearch(term) }}
                      data-track-id="search-overlay-history"
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', background: 'none', border: 'none', borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--hairline)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <i className="ti ti-clock" style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>{term}</span>
                      <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div
        className="mobile-search-bar"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 78, zIndex: 97,
          background: 'var(--card)',
          borderTop: '1px solid rgba(0,0,0,.07)',
          boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', padding: hasSearch ? '8px 12px 6px' : '8px 12px' }}>
          <input
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputValue.trim()) runSearch(inputValue)
              else if (e.key === 'Escape') dismiss()
            }}
            placeholder="Rezepte suchen …"
            data-track-id="search-input"
            style={{
              width: '100%', padding: '0.45rem 1rem',
              border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg)', color: 'var(--text)',
              fontSize: '0.9rem', fontFamily: 'var(--font-body)',
              outline: 'none', transition: 'var(--transition)',
              boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
            }}
          />
          {hasSearch && (
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
