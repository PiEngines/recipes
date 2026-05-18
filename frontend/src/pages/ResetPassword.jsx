import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [expired, setExpired] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return
    }

    setLoading(true)
    try {
      await client.post('/api/auth/reset-password', { token, new_password: newPassword })
      setSuccess(true)
    } catch (err) {
      const status = err.response?.status
      if (status === 400) {
        setExpired(true)
      } else {
        setError(err.response?.data?.detail || 'Ein Fehler ist aufgetreten.')
        setShake(true)
        setTimeout(() => setShake(false), 600)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div className={shake ? 'shake' : ''} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>🔒</div>
          <h1 style={headingStyle}>Neues Passwort</h1>
          <p style={{ color: '#6B6B68', margin: 0, fontSize: '0.925rem' }}>
            Gib dein neues Passwort ein.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#2C2C2A', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.5rem', background: 'rgba(107,124,78,0.1)', padding: '1rem', borderRadius: '10px' }}>
              Passwort geändert. Du kannst dich jetzt anmelden.
            </p>
            <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Zur Anmeldung →
            </Link>
          </div>
        ) : expired ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#C8602A', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.5rem', background: 'rgba(200,96,42,0.08)', padding: '1rem', borderRadius: '10px' }}>
              Dieser Link ist abgelaufen.
            </p>
            <Link to="/forgot-password" style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Neuen Link anfordern →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="float-group">
              <input
                id="rp-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder=" "
                required
                autoComplete="new-password"
                autoFocus
              />
              <label htmlFor="rp-password">Neues Passwort (min. 8 Zeichen, 1 Zahl)</label>
            </div>

            <div className="float-group">
              <input
                id="rp-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder=" "
                required
                autoComplete="new-password"
              />
              <label htmlFor="rp-password-confirm">Passwort bestätigen</label>
            </div>

            {error && (
              <p style={{ color: '#C8602A', fontSize: '0.875rem', textAlign: 'center', margin: '0 0 1rem', fontWeight: 500 }}>
                {error}
              </p>
            )}

            <ResetButton loading={loading} />

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link to="/login" style={{ color: 'var(--subtext)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                ← Zurück zur Anmeldung
              </Link>
            </div>
          </form>
        )}
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

function ResetButton({ loading }) {
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
        marginTop: '0.25rem',
      }}
    >
      {loading ? 'Wird gespeichert …' : 'Passwort speichern'}
    </button>
  )
}
