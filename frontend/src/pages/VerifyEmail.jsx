import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [state, setState] = useState('loading') // 'loading' | 'active' | 'pending' | 'error'

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    client.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => {
        setState(res.data.status === 'active' ? 'active' : 'pending')
      })
      .catch(() => {
        setState('error')
      })
  }, [token])

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {state === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>⏳</div>
            <h1 style={headingStyle}>Wird überprüft …</h1>
            <p style={{ color: '#6B6B68', margin: 0, fontSize: '0.925rem' }}>Bitte warten.</p>
          </div>
        )}

        {state === 'active' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>✅</div>
            <h1 style={headingStyle}>Email bestätigt!</h1>
            <p style={{ color: '#6B6B68', margin: '0 0 1.75rem', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Deine Email wurde bestätigt. Du kannst dich jetzt einloggen.
            </p>
            <Link to="/login" style={btnStyle}>
              Zur Anmeldung
            </Link>
          </div>
        )}

        {state === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>✉️</div>
            <h1 style={headingStyle}>Email bestätigt</h1>
            <p style={{ color: '#6B6B68', margin: '0 0 1.75rem', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Deine Email wurde bestätigt. Dein Konto wird noch vom Chefkoch freigeschaltet.
              Du erhältst eine Email, sobald dein Konto aktiviert wurde.
            </p>
            <Link to="/login" style={btnStyle}>
              Zur Anmeldung
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>❌</div>
            <h1 style={headingStyle}>Link ungültig</h1>
            <p style={{ color: '#6B6B68', margin: '0 0 1.75rem', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Dieser Link ist abgelaufen oder ungültig.
              Bitte registriere dich erneut oder fordere einen neuen Link an.
            </p>
            <Link to="/register" style={btnStyle}>
              Zur Registrierung
            </Link>
          </div>
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
  margin: '0 0 0.75rem',
  letterSpacing: '-0.01em',
}

const btnStyle = {
  display: 'inline-block',
  padding: '0.75rem 2rem',
  background: '#C8602A',
  color: '#fff',
  borderRadius: '10px',
  textDecoration: 'none',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '0.95rem',
}
