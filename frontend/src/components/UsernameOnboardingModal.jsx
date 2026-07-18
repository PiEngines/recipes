import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'

export default function UsernameOnboardingModal() {
  const { user, setUser } = useAuth()
  const [username, setUsername] = useState('')
  const [check, setCheck] = useState({ status: 'idle', message: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = username.trim()
    if (!trimmed) {
      setCheck({ status: 'idle', message: '' })
      return
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      setCheck({ status: 'invalid', message: 'Nur a-z, A-Z, 0-9, _ und - (3-30 Zeichen)' })
      return
    }
    setCheck({ status: 'checking', message: 'Prüfe Verfügbarkeit …' })
    const timeout = setTimeout(() => {
      client.get(`/api/auth/check-username/${encodeURIComponent(trimmed)}`)
        .then(res => {
          setCheck(
            res.data.available
              ? { status: 'available', message: 'Verfügbar' }
              : { status: 'taken', message: 'Bereits vergeben' }
          )
        })
        .catch(() => setCheck({ status: 'idle', message: '' }))
    }, 400)
    return () => clearTimeout(timeout)
  }, [username])

  if (!user || user.username) return null

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    const trimmed = username.trim()
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      setError('Username muss 3-30 Zeichen lang sein und darf nur a-z, A-Z, 0-9, _ und - enthalten')
      return
    }
    if (check.status === 'taken') {
      setError('Dieser Username ist bereits vergeben')
      return
    }
    setLoading(true)
    try {
      const res = await client.post('/api/auth/set-username', { username: trimmed })
      setUser(res.data)
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      setError(
        err.response?.status === 409
          ? 'Dieser Username ist bereits vergeben.'
          : detail || 'Ein Fehler ist aufgetreten.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.5rem' }}>
          👋 Wähle einen Username
        </h2>
        <p style={{ color: 'var(--subtext)', fontSize: '0.9rem', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
          Bevor es weitergeht, brauchen wir noch einen Username für dein Konto. Du kannst dich damit künftig auch einloggen.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="float-group">
            <input
              id="onboarding-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder=" "
              required
              autoComplete="username"
              autoFocus
            />
            <label htmlFor="onboarding-username">Username</label>
          </div>
          {check.message && (
            <p style={{
              color: check.status === 'available' ? '#3F7D4D'
                : check.status === 'checking' ? 'var(--subtext)'
                : 'var(--accent)',
              fontSize: '0.8rem',
              margin: '-0.65rem 0 0.85rem',
              fontFamily: 'Inter, sans-serif',
            }}>
              {check.message}
            </p>
          )}

          {error && (
            <p style={{ color: 'var(--accent)', fontSize: '0.875rem', margin: '0 0 1rem', fontWeight: 500 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: loading ? '#D49070' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-input)',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            {loading ? 'Wird gespeichert …' : 'Username festlegen'}
          </button>
        </form>
      </div>
    </div>
  )
}
