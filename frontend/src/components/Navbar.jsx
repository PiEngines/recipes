import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { isChefkochOrAbove, isKochOrAbove } from '../utils/roles'

// ── Icons ─────────────────────────────────────────────────────────────────────

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none',
        border: `1.5px solid ${hov ? 'var(--accent)' : 'var(--border-input)'}`,
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: hov ? 'var(--accent)' : 'var(--subtext)',
        transition: 'var(--transition)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function MenuItem({ onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        background: hov ? 'rgba(200,96,42,0.1)' : 'none',
        border: 'none',
        borderRadius: '6px',
        textAlign: 'left',
        cursor: 'pointer',
        color: 'var(--text)',
        fontSize: '0.9rem',
        fontFamily: 'Inter, sans-serif',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

function NavSearchInput({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="Rezepte suchen …"
      style={{
        width: '100%',
        padding: '0.5rem 1rem',
        border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: '0.9rem',
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        transition: 'var(--transition)',
        boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none',
      }}
    />
  )
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        borderRadius: '999px',
        border: `1px solid ${active ? '#C8602A' : 'var(--border-input)'}`,
        padding: '5px 12px',
        fontSize: '13px',
        background: active ? '#C8602A' : 'transparent',
        color: active ? '#fff' : 'var(--subtext)',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        userSelect: 'none',
        transition: 'var(--transition)',
      }}
    >
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

function ScopeCheckboxes({ scopeDesc, scopeIng, scopeAuthor, onToggleDesc, onToggleIng, onToggleAuthor }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <ScopePill active={scopeDesc} onClick={() => onToggleDesc(!scopeDesc)} icon="ti-search">
        Rezept durchsuchen
      </ScopePill>
      <ScopePill active={scopeIng} onClick={() => onToggleIng(!scopeIng)} icon="ti-leaf">
        mit Zutaten
      </ScopePill>
      <ScopePill active={scopeAuthor} onClick={() => onToggleAuthor(!scopeAuthor)} icon="ti-user">
        Nur Autor
      </ScopePill>
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

// Pages where the search bar (and optionally the create button) is hidden
const SEARCH_HIDDEN_PATHS = ['/profile', '/admin', '/admin/users', '/admin/recipes']
const EDIT_NEW_RE = /^\/recipes\/(new|\d+\/edit)$/

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const isEditOrNew = EDIT_NEW_RE.test(location.pathname)
  const hideSearch = SEARCH_HIDDEN_PATHS.includes(location.pathname) || isEditOrNew
  const hideCreate = isEditOrNew

  // Local input value, debounced to URL
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const scopeDesc = searchParams.get('scopeDesc') === '1'
  const scopeIng = searchParams.get('scopeIng') === '1'
  const scopeAuthor = searchParams.get('scopeAuthor') === '1'
  const hasSearch = Boolean(inputValue)

  // Keep a ref to location.pathname so debounce closure is never stale
  const pathnameRef = useRef(location.pathname)
  useEffect(() => { pathnameRef.current = location.pathname }, [location.pathname])

  // Debounce: write input to URL, navigate to / if needed
  useEffect(() => {
    const t = setTimeout(() => {
      if (pathnameRef.current !== '/') {
        if (inputValue) navigate(`/?q=${encodeURIComponent(inputValue)}`)
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
        // "Nur Autor" is mutually exclusive with the other scope checkboxes
        if (key === 'scopeAuthor') {
          next.delete('scopeDesc')
          next.delete('scopeIng')
        } else {
          next.delete('scopeAuthor')
        }
      } else {
        next.delete(key)
      }
      next.delete('page')
      return next
    }, { replace: true })
  }

  // Avatar dropdown
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!showMenu) return
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  // ── Mobile row 2: scroll-driven show/hide ────────────────────────────────────

  const [showRow2, setShowRow2] = useState(true)
  const lastScrollY = useRef(0)
  const touchStartY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY
      const delta = lastScrollY.current - current
      if (delta > 10) setShowRow2(true)        // scroll up → show
      else if (delta < -10) setShowRow2(false) // scroll down → hide
      lastScrollY.current = current
    }
    const onTouchStart = e => { touchStartY.current = e.touches[0].clientY }
    const onTouchEnd = e => {
      if (e.changedTouches[0].clientY - touchStartY.current > 10) setShowRow2(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const canCreate = isKochOrAbove(user)
  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  // Whether to show mobile row 2 at all (needs search or new-recipe button)
  const hasRow2Content = !hideSearch || (!hideCreate && canCreate)

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--card)', boxShadow: 'var(--shadow)', transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── Main row ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: '64px' }}>

          {/* Logo */}
          <Link to="/recipes" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              🍽️ PiEngines
            </span>
          </Link>

          {/* Center flex-1 area: search on /  pages; empty spacer on profile/admin */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!hideSearch && (
              <div className="hidden sm:block">
                <NavSearchInput value={inputValue} onChange={setInputValue} />
              </div>
            )}
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            <IconBtn onClick={toggle} title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </IconBtn>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu(m => !m)}
                title={user?.name}
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                {initials}
              </button>
              {showMenu && (
                <div style={{ position: 'absolute', right: 0, top: '44px', background: 'var(--card)', boxShadow: 'var(--shadow-hover)', borderRadius: '10px', padding: '0.375rem', minWidth: '170px', zIndex: 200 }}>
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--subtext)', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>{user?.name}</div>
                  <MenuItem onClick={() => { setShowMenu(false); navigate('/profile') }}>Mein Profil</MenuItem>
                  {isChefkochOrAbove(user) && <MenuItem onClick={() => { setShowMenu(false); navigate('/admin') }}>Admin-Bereich</MenuItem>}
                  <MenuItem onClick={() => { setShowMenu(false); logout() }}>Abmelden</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop: scope checkboxes (only on search pages, collapses without query) */}
        {!hideSearch && (
          <div
            className="hidden sm:block"
            style={{
              overflow: 'hidden',
              maxHeight: hasSearch ? '40px' : '0',
              opacity: hasSearch ? 1 : 0,
              transition: 'max-height 0.25s ease, opacity 0.25s ease',
              paddingBottom: hasSearch ? '0.5rem' : 0,
            }}
          >
            <ScopeCheckboxes
              scopeDesc={scopeDesc}
              scopeIng={scopeIng}
              scopeAuthor={scopeAuthor}
              onToggleDesc={v => toggleScope('scopeDesc', v)}
              onToggleIng={v => toggleScope('scopeIng', v)}
              onToggleAuthor={v => toggleScope('scopeAuthor', v)}
            />
          </div>
        )}

        {/* ── Mobile: row 2 (search + new + checkboxes) ─────────────────────── */}
        {hasRow2Content && (
          <div
            className="sm:hidden"
            style={{
              overflow: 'hidden',
              maxHeight: showRow2 ? '120px' : '0',
              opacity: showRow2 ? 1 : 0,
              transition: 'max-height 0.3s ease, opacity 0.3s ease',
              paddingBottom: showRow2 ? '0.625rem' : 0,
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: !hideSearch && hasSearch ? '0.4rem' : 0 }}>
              {!hideSearch && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NavSearchInput value={inputValue} onChange={setInputValue} />
                </div>
              )}
            </div>
            {!hideSearch && hasSearch && (
              <ScopeCheckboxes
                scopeDesc={scopeDesc}
                scopeIng={scopeIng}
                scopeAuthor={scopeAuthor}
                onToggleDesc={v => toggleScope('scopeDesc', v)}
                onToggleIng={v => toggleScope('scopeIng', v)}
                onToggleAuthor={v => toggleScope('scopeAuthor', v)}
              />
            )}
          </div>
        )}

      </div>
    </header>
  )
}
