import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import AuthShell from '../components/auth/AuthShell'
import { Button, Input } from '../components/ui'

export default function Register() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [usernameCheck, setUsernameCheck] = useState({ status: 'idle', message: '' })
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [successStatus, setSuccessStatus] = useState('verification_sent')

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  useEffect(() => {
    const trimmed = username.trim()
    if (!trimmed) {
      setUsernameCheck({ status: 'idle', message: '' })
      return
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      setUsernameCheck({ status: 'invalid', message: 'Nur a-z, A-Z, 0-9, _ und - (3-30 Zeichen)' })
      return
    }
    setUsernameCheck({ status: 'checking', message: 'Prüfe Verfügbarkeit …' })
    const timeout = setTimeout(() => {
      client.get(`/api/auth/check-username/${encodeURIComponent(trimmed)}`)
        .then(res => {
          setUsernameCheck(
            res.data.available
              ? { status: 'available', message: 'Verfügbar' }
              : { status: 'taken', message: 'Bereits vergeben' }
          )
        })
        .catch(() => setUsernameCheck({ status: 'idle', message: '' }))
    }, 400)
    return () => clearTimeout(timeout)
  }, [username])

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
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
      setError('Username muss 3-30 Zeichen lang sein und darf nur a-z, A-Z, 0-9, _ und - enthalten')
      triggerShake()
      return
    }
    if (usernameCheck.status === 'taken') {
      setError('Dieser Username ist bereits vergeben')
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
      const res = await client.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
        token: token || undefined,
      })
      setSuccessStatus(res.data.status || 'verification_sent')
      setEmailSent(true)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (status === 409 && detail.includes('Username')) {
        setError('Dieser Username ist bereits vergeben.')
      } else if (status === 409 && detail.includes('Email')) {
        setError('Diese Email-Adresse ist bereits vergeben.')
      } else if (status === 409) {
        setError(detail || 'Diese Email-Adresse ist bereits vergeben.')
      } else if (status === 400 && detail.includes('Username')) {
        setError(detail)
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
      <AuthShell
        icon="✉️"
        title={successStatus === 'pending' ? 'Anfrage gesendet' : 'Bestätigungs-Email gesendet'}
        subtitle={successStatus === 'pending'
          ? 'Deine Anfrage wurde gesendet. Der Admin wird dein Konto prüfen und dich dann kontaktieren.'
          : 'Wir haben dir eine Bestätigungs-Email gesendet. Bitte klicke auf den Link in der Email um dein Konto zu aktivieren.'}
      >
        <div className="auth-links">
          <Link to="/login" className="auth-link auth-link--accent" data-track-id="register-back-login-link">
            ← Zurück zur Anmeldung
          </Link>
        </div>
      </AuthShell>
    )
  }

  const usernameHintClass =
    usernameCheck.status === 'available' ? 'auth-hint auth-hint--available'
    : usernameCheck.status === 'checking' ? 'auth-hint auth-hint--checking'
    : 'auth-hint auth-hint--error'

  return (
    <AuthShell
      icon="🍽️"
      title="Konto erstellen"
      subtitle={token ? 'Du wurdest eingeladen. Fülle das Formular aus.' : 'Registriere dich für PiEngines Recipes'}
      shake={shake}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          id="reg-name"
          label="Vollständiger Name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoComplete="name"
          autoFocus
          trackId="register-name-input"
        />

        <Input
          id="reg-email"
          label="E-Mail-Adresse"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
          required
          autoComplete="email"
          trackId="register-email-input"
        />

        <div>
          <Input
            id="reg-username"
            label="Username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
            trackId="register-username-input"
          />
          <p className="auth-hint auth-hint--rule" style={{ marginTop: '0.5rem' }}>
            Erlaubte Zeichen: a-z, A-Z, 0-9, _ und -. 3-30 Zeichen, keine Leerzeichen, keine Umlaute.
          </p>
          {usernameCheck.message && (
            <p className={usernameHintClass} style={{ marginTop: '0.35rem' }}>
              {usernameCheck.message}
            </p>
          )}
        </div>

        <Input
          id="reg-password"
          label="Passwort (min. 8 Zeichen, 1 Zahl)"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          trackId="register-password-input"
        />

        <Input
          id="reg-password-confirm"
          label="Passwort bestätigen"
          type="password"
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          trackId="register-password-confirm-input"
        />

        {error && <p className="auth-msg auth-msg--error">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          full
          className="auth-submit"
          disabled={loading}
          trackId="register-form-submit"
        >
          {loading ? 'Wird registriert …' : 'Registrieren'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/login" className="auth-link" data-track-id="register-login-link">
          Bereits registriert? <strong>Zum Login</strong>
        </Link>
      </div>
    </AuthShell>
  )
}
