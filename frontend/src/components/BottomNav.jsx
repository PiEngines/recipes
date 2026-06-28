import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isKochOrAbove } from '../utils/roles'

const ACCENT = '#C8602A'
const MUTED = '#9A958C'

export default function BottomNav() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canCreate = isKochOrAbove(user)
  const [moreOpen, setMoreOpen] = useState(false)

  const isHome = pathname === '/'
  const isRezepte = pathname === '/recipes' && !searchParams.get('author_id')
  const isFavoriten = pathname === '/favorites'
  const isNeu = pathname === '/recipes/new'

  const slotStyle = (active) => ({
    flex: 1,
    height: '100%',
    background: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    color: active ? ACCENT : MUTED,
    textDecoration: 'none',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  })

  const slotLabel = (text) => (
    <span style={{ fontSize: 11, fontWeight: 500 }}>{text}</span>
  )

  const MEHR_ITEMS = [
    { icon: 'ti-user', label: 'Eigene', to: user ? `/recipes?author_id=${user.id}` : '/recipes', trackId: 'bottom-mehr-eigene-click' },
    { icon: 'ti-calendar-event', label: 'Saison', to: '/seasonal', trackId: 'bottom-mehr-saison-click' },
    { icon: 'ti-fridge', label: 'Kühlschrank', to: '/fratcher', trackId: 'bottom-mehr-fratcher-click' },
    { icon: 'ti-leaf', label: 'Kräuter', to: '/seasonal', trackId: 'bottom-mehr-kraeuter-click' },
  ]

  return (
    <>
      {/* Backdrop to close "Mehr" panel */}
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 98 }}
        />
      )}

      {/* "Mehr" slide-up panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 60,
          left: 0,
          right: 0,
          zIndex: 99,
          background: 'var(--card)',
          borderTop: '1px solid rgba(0,0,0,.07)',
          display: 'flex',
          padding: '8px 0 12px',
          transform: moreOpen ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform .22s ease',
          boxShadow: '0 -4px 20px rgba(0,0,0,.08)',
        }}
        className="bottom-nav"
      >
        {MEHR_ITEMS.map(({ icon, label, to, trackId }) => (
          <Link
            key={label}
            to={to}
            onClick={() => setMoreOpen(false)}
            data-track-id={trackId}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: MUTED,
              textDecoration: 'none',
              padding: '8px 0',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
            <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          </Link>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Main BottomNav bar */}
      <nav
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'var(--card)',
          borderTop: '1px solid rgba(0,0,0,.07)',
          display: 'flex',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        <Link to="/" data-track-id="bottom-nav-home-click" style={slotStyle(isHome)}>
          <i className="ti ti-home-2" style={{ fontSize: 21 }} />
          {slotLabel('Start')}
        </Link>

        <Link to="/recipes" data-track-id="bottom-nav-rezepte-click" style={slotStyle(isRezepte)}>
          <i className="ti ti-book-2" style={{ fontSize: 21 }} />
          {slotLabel('Rezepte')}
        </Link>

        <Link to="/favorites" data-track-id="bottom-nav-favoriten-click" style={slotStyle(isFavoriten)}>
          <i className="ti ti-heart" style={{ fontSize: 21 }} />
          {slotLabel('Favoriten')}
        </Link>

        {canCreate ? (
          <Link to="/recipes/new" data-track-id="bottom-nav-neu-click" style={slotStyle(isNeu)}>
            <i className="ti ti-plus" style={{ fontSize: 22 }} />
            {slotLabel('Neu')}
          </Link>
        ) : (
          <span data-track-id="bottom-nav-neu-click" style={{ ...slotStyle(false), opacity: 0.3, cursor: 'default' }}>
            <i className="ti ti-plus" style={{ fontSize: 22 }} />
            {slotLabel('Neu')}
          </span>
        )}

        <button
          onClick={() => setMoreOpen(m => !m)}
          data-track-id="bottom-nav-mehr-click"
          style={slotStyle(moreOpen)}
        >
          <i className="ti ti-dots" style={{ fontSize: 21 }} />
          {slotLabel('Mehr')}
        </button>
      </nav>
    </>
  )
}
