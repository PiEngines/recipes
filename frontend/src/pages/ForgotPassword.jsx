import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await client.post('/api/auth/forgot-password', { email })
    } catch {
      // swallow — show success regardless
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>🔑</div>
          <h1 style={headingStyle}>Passwort vergessen</h1>
          <p style={{ color: '#6B6B68', margin: 0, fontSize: '0.925rem' }}>
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#2C2C2A', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.5rem', background: 'rgba(107,124,78,0.1)', padding: '1rem', borderRadius: '10px' }}>
              Falls diese E-Mail-Adresse registriert ist, erhältst du in Kürze eine Nachricht mit einem Link zum Zurücksetzen.
            </p>
            <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              ← Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="float-group">
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder=" "
                required
                autoComplete="email"
                autoFocus
              />
              <label htmlFor="fp-email">E-Mail-Adresse</label>
            </div>

            <SubmitButton loading={loading} />

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
  background: 'linear-gradient(135deg, var(--accent) 0%, #D9845A 25%, #EEC89A 55%, #FAF7F2 80%, #F0EDE8 100%)',
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

function SubmitButton({ loading }) {
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
        background: loading ? '#D49070' : hovered ? 'var(--accent-hover)' : 'var(--accent)',
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
      {loading ? 'Wird gesendet …' : 'Link anfordern'}
    </button>
  )
}
