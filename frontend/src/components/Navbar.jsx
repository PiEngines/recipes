import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { isChefkoch, isKochOrAbove } from '../utils/roles'

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

function ScopeCheckboxes({ scopeDesc, scopeIng, onToggleDesc, onToggleIng }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>
        <input type="checkbox" checked={scopeDesc} onChange={e => onToggleDesc(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Beschreibung einbeziehen
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>
        <input type="checkbox" checked={scopeIng} onChange={e => onToggleIng(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Zutaten einbeziehen
      </label>
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Local input value, debounced to URL
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const scopeDesc = searchParams.get('scopeDesc') === '1'
  const scopeIng = searchParams.get('scopeIng') === '1'
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
      if (val) next.set(key, '1')
      else next.delete(key)
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

  // Mobile row 2: hide after 3s, re-show on scroll-up or swipe-down
  const [showRow2, setShowRow2] = useState(true)
  const hideTimerRef = useRef(null)
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const touchStartY = useRef(0)

  const resetHideTimer = useCallback(() => {
    setShowRow2(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowRow2(false), 3000)
  }, [])

  useEffect(() => {
    hideTimerRef.current = setTimeout(() => setShowRow2(false), 3000)
    return () => clearTimeout(hideTimerRef.current)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY
      if (current < lastScrollY.current) resetHideTimer()
      lastScrollY.current = current
    }
    const onTouchStart = e => { touchStartY.current = e.touches[0].clientY }
    const onTouchEnd = e => {
      if (e.changedTouches[0].clientY - touchStartY.current > 30) resetHideTimer()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [resetHideTimer])

  const canCreate = isKochOrAbove(user)
  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  const newRecipeButton = (label) => (
    <button
      onClick={() => navigate('/recipes/new')}
      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: '1.5px solid var(--accent)', color: 'var(--accent)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, transition: 'var(--transition)', flexShrink: 0, whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}
    </button>
  )

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--card)', boxShadow: 'var(--shadow)', transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── Main row ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: '64px' }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              🍽️ PiEngines
            </span>
          </Link>

          {/* Search – desktop: flex-1 spacer; mobile: hidden */}
          <div className="hidden sm:block" style={{ flex: 1, minWidth: 0 }}>
            <NavSearchInput value={inputValue} onChange={setInputValue} />
          </div>

          {/* Spacer – mobile only, pushes controls right when search is hidden */}
          <div className="sm:hidden" style={{ flex: 1 }} />

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            {canCreate && (
              <div className="hidden sm:block">
                {newRecipeButton('+ Neues Rezept')}
              </div>
            )}
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
                  {isChefkoch(user) && <MenuItem onClick={() => { setShowMenu(false); navigate('/admin') }}>Admin-Bereich</MenuItem>}
                  <MenuItem onClick={() => { setShowMenu(false); logout() }}>Abmelden</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop: scope checkboxes (collapses when no search active) ──── */}
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
            onToggleDesc={v => toggleScope('scopeDesc', v)}
            onToggleIng={v => toggleScope('scopeIng', v)}
          />
        </div>

        {/* ── Mobile: row 2 (search + new + checkboxes) ─────────────────────── */}
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: hasSearch ? '0.4rem' : 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NavSearchInput value={inputValue} onChange={setInputValue} />
            </div>
            {canCreate && newRecipeButton('+ Neu')}
          </div>
          {hasSearch && (
            <ScopeCheckboxes
              scopeDesc={scopeDesc}
              scopeIng={scopeIng}
              onToggleDesc={v => toggleScope('scopeDesc', v)}
              onToggleIng={v => toggleScope('scopeIng', v)}
            />
          )}
        </div>

      </div>
    </header>
  )
}
