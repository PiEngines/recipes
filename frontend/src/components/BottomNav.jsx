import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isKochOrAbove } from '../utils/roles'

// Bottom-Nav Wahl 2.0 (SPEC §2.7): 5 Slots — Home · Rezepte · Neu (zentraler
// erhöhter +) · Garten · Mehr. Höhe 78px, Creme-Fläche mit Holz-Oberkante.
// Aktiv = dunkles Ink-Icon+Label (var(--text)), inaktiv = var(--nav-muted).
// (Prototyp screens/*.html rendern den aktiven Slot bewusst dunkel, nicht Terrakotta.)
// Profil liegt unter »Mehr« — KEIN eigener Slot.

const ICON = 22

export default function BottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const canCreate = isKochOrAbove(user)
  const [moreOpen, setMoreOpen] = useState(false)

  // Aktiver-Tab-Logik (SPEC §2.7): eigener Bereich → Slot aktiv;
  // hineingesprungene Unterseiten (fremdes Profil) → Footer neutral;
  // Mehr-Panel-Ziele → »Mehr« aktiv.
  const startsWith = (p) => pathname === p || pathname.startsWith(p + '/')
  const isNeu = pathname === '/recipes/new'
  const isHome = pathname === '/'
  const isRezepte = startsWith('/recipes') && !isNeu
  // Garten-Slot führt auf »Mein Beet«; Kräuterschule und Pflanzen-Detail sind
  // von dort aus erreichbar und halten den Slot ebenfalls aktiv.
  const isGarten = startsWith('/garten') || startsWith('/kraeuterschule') || startsWith('/pflanzen')
  // Kräuterschule fehlt hier bewusst — sie gehört zum Garten-Slot.
  const MEHR_PATHS = ['/profile', '/favorites', '/categories', '/seasonal', '/fratcher', '/einkaufsliste']
  const isMehr = moreOpen || MEHR_PATHS.some(startsWith)

  const slotStyle = (active) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    padding: '2px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    color: active ? 'var(--text)' : 'var(--nav-muted)',
  })

  const labelStyle = (active) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: active ? 600 : 400,
    letterSpacing: '.04em',
    color: active ? 'var(--text)' : 'var(--nav-muted)',
  })

  const MEHR_ITEMS = [
    { icon: 'ti-user', label: 'Profil', to: '/profile', trackId: 'bottom-mehr-profil-click' },
    { icon: 'ti-heart', label: 'Favoriten', to: '/favorites', trackId: 'bottom-mehr-favoriten-click' },
    { icon: 'ti-category', label: 'Kategorien', to: '/categories', trackId: 'bottom-mehr-kategorien-click' },
    { icon: 'ti-calendar-event', label: 'Saison', to: '/seasonal', trackId: 'bottom-mehr-saison-click' },
    { icon: 'ti-plant-2', label: 'Kräuterschule', to: '/kraeuterschule', trackId: 'bottom-mehr-kraeuterschule-click' },
    { icon: 'ti-fridge', label: 'Kühlschrank', to: '/fratcher', trackId: 'bottom-mehr-fratcher-click' },
    { icon: 'ti-basket', label: 'Einkaufsliste', to: '/einkaufsliste', trackId: 'bottom-mehr-einkaufsliste-click' },
  ]

  const mehrItemStyle = (dimmed) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 0',
    color: 'var(--nav-muted)',
    textDecoration: 'none',
    opacity: dimmed ? 0.4 : 1,
    cursor: dimmed ? 'default' : 'pointer',
    fontFamily: 'var(--font-mono)',
  })

  return (
    <>
      {/* Backdrop zum Schließen des »Mehr«-Panels */}
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      )}

      {/* »Mehr«-Slide-up-Panel */}
      <div
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 78,
          left: 0,
          right: 0,
          zIndex: 99,
          background: 'var(--surface)',
          borderTop: '2px solid var(--nav-top)',
          padding: '6px 0 10px',
          transform: moreOpen ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform .22s ease',
          boxShadow: '0 -4px 20px rgba(0,0,0,.10)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: 480, margin: '0 auto' }}>
          {MEHR_ITEMS.map(({ icon, label, to, trackId }) => {
            const inner = (
              <>
                <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.02em' }}>
                  {label}{!to && ' · bald'}
                </span>
              </>
            )
            return to ? (
              <Link
                key={label}
                to={to}
                onClick={() => setMoreOpen(false)}
                data-track-id={trackId}
                style={{ ...mehrItemStyle(false), flexBasis: '33.333%' }}
              >
                {inner}
              </Link>
            ) : (
              <span
                key={label}
                data-track-id={trackId}
                aria-disabled="true"
                style={{ ...mehrItemStyle(true), flexBasis: '33.333%' }}
              >
                {inner}
              </span>
            )
          })}
        </div>
      </div>

      {/* Haupt-Leiste */}
      <nav
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 78,
          background: 'var(--bg)',
          borderTop: '2px solid var(--nav-top)',
          boxShadow: '0 -2px 0 var(--nav-top-shadow)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '10px 4px 0',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', width: '100%', maxWidth: 480 }}>
          <Link to="/" data-track-id="bottom-nav-home-click" style={slotStyle(isHome)}>
            <i className="ti ti-home" style={{ fontSize: ICON }} />
            <span style={labelStyle(isHome)}>Home</span>
          </Link>

          <Link to="/recipes" data-track-id="bottom-nav-rezepte-click" style={slotStyle(isRezepte)}>
            <i className="ti ti-book-2" style={{ fontSize: ICON }} />
            <span style={labelStyle(isRezepte)}>Rezepte</span>
          </Link>

          {/* Neu — zentraler erhöhter + (44×44, dunkel, −16px) */}
          {canCreate ? (
            <Link to="/recipes/new" data-track-id="bottom-nav-neu-click" style={{ ...slotStyle(isNeu), gap: 2 }}>
              <span style={{ width: 44, height: 44, borderRadius: 6, marginTop: -16, background: 'var(--ink-braun)', boxShadow: 'var(--nav-fab-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: 24, color: 'var(--on-accent)' }} />
              </span>
              <span style={labelStyle(isNeu)}>Neu</span>
            </Link>
          ) : (
            <span data-track-id="bottom-nav-neu-click" style={{ ...slotStyle(false), gap: 2, opacity: 0.4, cursor: 'default' }}>
              <span style={{ width: 44, height: 44, borderRadius: 6, marginTop: -16, background: 'var(--ink-braun)', boxShadow: 'var(--nav-fab-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: 24, color: 'var(--on-accent)' }} />
              </span>
              <span style={labelStyle(false)}>Neu</span>
            </span>
          )}

          <Link to="/garten" data-track-id="bottom-nav-garten-click" style={slotStyle(isGarten)}>
            <i className="ti ti-plant-2" style={{ fontSize: ICON }} />
            <span style={labelStyle(isGarten)}>Garten</span>
          </Link>

          <button onClick={() => setMoreOpen(m => !m)} data-track-id="bottom-nav-mehr-click" style={slotStyle(isMehr)}>
            <i className="ti ti-dots" style={{ fontSize: ICON }} />
            <span style={labelStyle(isMehr)}>Mehr</span>
          </button>
        </div>
      </nav>
    </>
  )
}
