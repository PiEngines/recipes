import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isKochOrAbove } from '../utils/roles'

function buildItems(userId) {
  return [
    {
      icon: 'ti-home', label: 'Start', route: '/', trackId: 'bottom-nav-home-click',
      isActive: (pathname) => pathname === '/',
    },
    {
      icon: 'ti-heart', label: 'Favoriten', route: '/favorites', trackId: 'bottom-nav-favorites-click',
      isActive: (pathname) => pathname === '/favorites',
    },
    {
      icon: 'ti-user', label: 'Eigene', route: `/recipes?author_id=${userId}`, trackId: 'bottom-nav-own-click', requiresKoch: true,
      isActive: (pathname, searchParams) => pathname === '/recipes' && searchParams.get('author_id') === String(userId),
    },
    {
      icon: 'ti-plus', label: 'Neu', route: '/recipes/new', trackId: 'bottom-nav-new-click', requiresKoch: true,
      isActive: (pathname) => pathname === '/recipes/new',
    },
    {
      icon: 'ti-calendar', label: 'Saison', route: '/seasonal', trackId: 'bottom-nav-seasonal-click',
      isActive: (pathname) => pathname === '/seasonal',
    },
  ]
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canCreate = isKochOrAbove(user)
  const ITEMS = buildItems(user?.id)

  return (
    <nav
      className="bottom-nav"
      style={{
        display: 'flex',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'var(--bg)',
        borderTop: '0.5px solid var(--border)',
        zIndex: 100,
      }}
    >
      {ITEMS.map(({ icon, label, route, requiresKoch, trackId, isActive }) => {
        const active = isActive(pathname, searchParams)
        const disabled = requiresKoch && !canCreate
        const color = active ? '#C8602A' : 'var(--subtext)'
        const content = (
          <>
            <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: '1.25rem' }} />
            <span style={{ fontSize: '0.65rem' }}>{label}</span>
          </>
        )
        const itemStyle = {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.15rem',
          color,
          textDecoration: 'none',
          fontFamily: 'Inter, sans-serif',
          opacity: disabled ? 0.3 : 1,
        }

        if (disabled) {
          return (
            <span key={route} data-track-id={trackId} style={itemStyle}>
              {content}
            </span>
          )
        }

        return (
          <Link key={route} to={route} data-track-id={trackId} style={itemStyle}>
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
