import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isChefkochOrAbove } from '../utils/roles'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🍽️</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Lädt …</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  return children
}

export function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to={redirect} replace />
  return children
}

export function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (!isChefkochOrAbove(user)) return <Navigate to="/" replace />
  return children
}
