import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      localStorage.setItem('just_logged_in', 'true')
      navigate('/', { replace: true })
    } catch {
      setError('E-Mail oder Passwort ist falsch.')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #C8602A 0%, #D9845A 25%, #EEC89A 55%, #FAF7F2 80%, #F0EDE8 100%)',
    }}>
      <div
        className={shake ? 'shake' : ''}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          padding: '2.75rem 2.25rem',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>🍽️</div>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.8rem',
            fontWeight: 600,
            color: '#2C2C2A',
            margin: '0 0 0.35rem',
            letterSpacing: '-0.01em',
          }}>
            PiEngines Recipes
          </h1>
          <p style={{ color: '#6B6B68', margin: 0, fontSize: '0.925rem' }}>
            Melde dich an, um fortzufahren
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="float-group">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder=" "
              required
              autoComplete="email"
              autoFocus
            />
            <label htmlFor="email">E-Mail-Adresse</label>
          </div>

          <div className="float-group">
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="current-password"
            />
            <label htmlFor="password">Passwort</label>
          </div>

          {error && (
            <p style={{
              color: '#C8602A',
              fontSize: '0.875rem',
              textAlign: 'center',
              margin: '0 0 1rem',
              fontWeight: 500,
            }}>
              {error}
            </p>
          )}

          <LoginButton loading={loading} />
        </form>
        <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
            Passwort vergessen?
          </Link>
          <Link to="/register" style={{ color: 'var(--subtext)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
            Noch kein Konto? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Registrieren</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function LoginButton({ loading }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '0.9rem',
        background: loading ? '#D49070' : hovered ? '#A84E22' : '#C8602A',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-input)',
        fontSize: '1rem',
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease',
        letterSpacing: '0.01em',
        marginTop: '0.25rem',
      }}
    >
      {loading ? 'Wird angemeldet …' : 'Anmelden'}
    </button>
  )
}
