import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'

export default function Register() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (name.trim().length < 2) {
      setError('Name muss mind. 2 Zeichen haben')
      triggerShake()
      return
    }
    if (!email.trim()) {
      setError('Bitte gib eine E-Mail-Adresse ein')
      triggerShake()
      return
    }
    if (password.length < 8 || !/\d/.test(password)) {
      setError('Passwort muss mind. 8 Zeichen und 1 Zahl enthalten')
      triggerShake()
      return
    }
    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      triggerShake()
      return
    }

    setLoading(true)
    try {
      await client.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        token: token || undefined,
      })
      setEmailSent(true)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (status === 409) {
        setError('Diese Email ist bereits registriert.')
      } else if (status === 400 && detail.includes('Wegwerf')) {
        setError('Bitte verwende eine echte Email-Adresse.')
      } else if (status === 400 && detail.includes('Passwort')) {
        setError(detail)
      } else {
        setError(detail || 'Ein Fehler ist aufgetreten.')
      }
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>✉️</div>
            <h1 style={headingStyle}>Bestätigungs-Email gesendet</h1>
            <p style={{ color: '#6B6B68', margin: '0 0 1.5rem', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Wir haben dir eine Bestätigungs-Email gesendet.
              Bitte klicke auf den Link in der Email um dein Konto zu aktivieren.
            </p>
            <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              ← Zurück zur Anmeldung
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div className={shake ? 'shake' : ''} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>🍽️</div>
          <h1 style={headingStyle}>Konto erstellen</h1>
          <p style={{ color: '#6B6B68', margin: 0, fontSize: '0.925rem' }}>
            {token ? 'Du wurdest eingeladen. Fülle das Formular aus.' : 'Registriere dich für PiEngines Recipes'}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="float-group">
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder=" "
              required
              autoComplete="name"
              autoFocus
            />
            <label htmlFor="reg-name">Vollständiger Name</label>
          </div>

          <div className="float-group">
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder=" "
              required
              autoComplete="email"
            />
            <label htmlFor="reg-email">E-Mail-Adresse</label>
          </div>

          <div className="float-group">
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="new-password"
            />
            <label htmlFor="reg-password">Passwort (min. 8 Zeichen, 1 Zahl)</label>
          </div>

          <div className="float-group">
            <input
              id="reg-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              placeholder=" "
              required
              autoComplete="new-password"
            />
            <label htmlFor="reg-password-confirm">Passwort bestätigen</label>
          </div>

          {error && (
            <p style={{ color: '#C8602A', fontSize: '0.875rem', textAlign: 'center', margin: '0 0 1rem', fontWeight: 500 }}>
              {error}
            </p>
          )}

          <RegisterButton loading={loading} />
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <Link to="/login" style={{ color: 'var(--subtext)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
            Bereits registriert? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Zum Login</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  background: 'linear-gradient(135deg, #C8602A 0%, #D9845A 25%, #EEC89A 55%, #FAF7F2 80%, #F0EDE8 100%)',
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
  padding: '2.75rem 2.25rem',
  width: '100%',
  maxWidth: '420px',
}

const headingStyle = {
  fontFamily: 'Playfair Display, serif',
  fontSize: '1.8rem',
  fontWeight: 600,
  color: '#2C2C2A',
  margin: '0 0 0.35rem',
  letterSpacing: '-0.01em',
}

function RegisterButton({ loading }) {
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
      {loading ? 'Wird registriert …' : 'Registrieren'}
    </button>
  )
}
