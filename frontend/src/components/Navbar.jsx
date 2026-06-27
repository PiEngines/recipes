import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { isChefkochOrAbove } from '../utils/roles'

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

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!showMenu) return
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--card)', boxShadow: 'var(--shadow)', transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: '64px' }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              🍽️ PiEngines
            </span>
          </Link>

          {/* Spacer */}
          <div style={{ flex: 1, minWidth: 0 }} />

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
      </div>
    </header>
  )
}
