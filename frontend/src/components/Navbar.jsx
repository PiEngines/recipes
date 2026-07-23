import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { isChefkochOrAbove } from '../utils/roles'

// Top-Nav / Header Wahl 2.0 (SPEC §2.8): Farbwelt-Ton (data-world → braun/grün).
// Home: Begrüßungsblock links (Lora) + Feed · Glocke(Badge) · Theme · Avatar rechts.
// Andere Seiten: schlanke Farbwelt-Leiste (Marke links, Theme + Avatar rechts) —
// bewusst KEIN globaler Kontext-Titel/Back-Pill, da jede Seite Titel + BackButton
// selbst rendert (Doppelung vermeiden; §2.8-Vollausbau folgt je Seiten-Redesign).

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

// Runder Icon-Button auf dunkler Farbwelt-Fläche (Creme-Icon, dezenter Umriss).
function IconBtn({ onClick, title, trackId, badge, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      data-track-id={trackId}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        background: hov ? 'rgba(240,232,208,.12)' : 'none',
        border: 'none',
        borderRadius: '50%',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--on-dark)',
        opacity: hov ? 1 : 0.85,
        transition: 'var(--transition)',
        flexShrink: 0,
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: 'var(--accent)', border: '1.5px solid var(--header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 8, lineHeight: 1, color: 'var(--on-accent)' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function MenuItem({ onClick, trackId, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      data-track-id={trackId}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        background: hov ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
        border: 'none',
        borderRadius: 6,
        textAlign: 'left',
        cursor: 'pointer',
        color: 'var(--text)',
        fontSize: '0.9rem',
        fontFamily: 'var(--font-body)',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

// Avatar-Kreis + Dropdown-Menü (Profil / Admin / Abmelden).
function AvatarMenu({ user, navigate, logout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(m => !m)}
        title={user?.name}
        aria-label="Konto-Menü"
        data-track-id="header-avatar-toggle"
        style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
      >
        {initials}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, background: 'var(--card)', boxShadow: 'var(--shadow-hover)', borderRadius: 10, padding: '0.375rem', minWidth: 180, zIndex: 200 }}>
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--subtext)', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem', fontFamily: 'var(--font-body)' }}>{user?.name}</div>
          <MenuItem trackId="header-menu-profil-click" onClick={() => { setOpen(false); navigate('/profile') }}>Mein Profil</MenuItem>
          {/* Einstellungen sind aus dem Mehr-Panel hierher gewandert (Ü19). */}
          <MenuItem trackId="header-menu-einstellungen-click" onClick={() => { setOpen(false); navigate('/einstellungen') }}>Einstellungen</MenuItem>
          {/* Beiträge sind aus dem Mehr-Panel hierher gewandert (BUG-04). */}
          <MenuItem trackId="header-menu-social-click" onClick={() => { setOpen(false); navigate('/social') }}>Beiträge</MenuItem>
          {isChefkochOrAbove(user) && <MenuItem trackId="header-menu-admin-click" onClick={() => { setOpen(false); navigate('/admin') }}>Admin-Bereich</MenuItem>}
          <MenuItem trackId="header-menu-logout-click" onClick={() => { setOpen(false); logout() }}>Abmelden</MenuItem>
        </div>
      )}
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar({ onBellClick, notificationCount = 0 }) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isHome = pathname === '/'
  // Garten-Welt (grün) umfasst Beet, Kräuterschule und Pflanzen-Detail (SPEC §1.1).
  const GRUEN = ['/garten', '/kraeuterschule', '/pflanzen']
  const world = GRUEN.some(p => pathname.startsWith(p)) ? 'gruen' : 'braun'

  const themeBtn = (
    <IconBtn onClick={toggle} trackId="header-theme-toggle" title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </IconBtn>
  )

  return (
    <header
      data-world={world}
      style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--header-bg)', transition: 'background-color 0.3s ease' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isHome ? '10px 20px 14px' : '0 20px' }}>
        {isHome ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            {/* Begrüßungsblock */}
            <Link to="/" data-track-id="header-brand-home-click" style={{ textDecoration: 'none', minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--on-dark)', opacity: 0.5 }}>Willkommen bei</p>
              <h1 style={{ margin: '2px 0 0', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '-0.3px', color: 'var(--on-dark)' }}>PiEngines</h1>
              <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', color: 'var(--on-dark)', opacity: 0.5 }}>— Rezepte &amp; Kräuterschule</p>
            </Link>
            {/* Rechts: Glocke · Theme · Avatar
                Kein Feed-Icon mehr: der Feed lebt seit F3b-3 in der
                Entdecken-Sektion der Startseite, nicht auf einer eigenen Seite. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <IconBtn onClick={onBellClick} trackId="header-notifications-click" title="Neuigkeiten" badge={notificationCount}>
                <i className="ti ti-bell" style={{ fontSize: 19 }} />
              </IconBtn>
              {themeBtn}
              <AvatarMenu user={user} navigate={navigate} logout={logout} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 64 }}>
            {/* Marke (Home-Link) */}
            <Link to="/" data-track-id="header-brand-home-click" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, fontWeight: 700, color: 'var(--on-dark)', whiteSpace: 'nowrap' }}>PiEngines</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {themeBtn}
              <AvatarMenu user={user} navigate={navigate} logout={logout} />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
