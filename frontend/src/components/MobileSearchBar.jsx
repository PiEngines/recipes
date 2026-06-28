import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const HIDE_PATHS = ['/profile', '/admin', '/admin/users', '/admin/recipes']
const EDIT_NEW_RE = /^\/recipes\/(new|\d+\/edit)$/
const RECIPE_DETAIL_RE = /^\/recipes\/\d+$/

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
        borderRadius: 999, border: `1px solid ${active ? '#C8602A' : 'var(--border-input)'}`,
        padding: '5px 12px', fontSize: 12,
        background: active ? '#C8602A' : 'transparent',
        color: active ? '#fff' : 'var(--subtext)',
        cursor: 'pointer', fontFamily: 'Inter, sans-serif', userSelect: 'none',
        transition: 'all .15s',
      }}
    >
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

export default function MobileSearchBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const pathnameRef = useRef(location.pathname)
  useEffect(() => { pathnameRef.current = location.pathname }, [location.pathname])

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

  if (isHidden) return null

  return (
    <div
      className="mobile-search-bar"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 60, zIndex: 95,
        background: 'var(--card)',
        borderTop: '1px solid rgba(0,0,0,.07)',
        boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: hasSearch ? '8px 12px 6px' : '8px 12px' }}>
        <input
          type="search"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Rezepte suchen …"
          data-track-id="search-input"
          style={{
            width: '100%', padding: '0.45rem 1rem',
            border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg)', color: 'var(--text)',
            fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
            outline: 'none', transition: 'var(--transition)',
            boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none',
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
  )
}
