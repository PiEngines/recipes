import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/auth/AuthShell'
import { Button, Input } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setEmailNotVerified(false)
    setResendSent(false)
    setLoading(true)
    try {
      await login(email, password)
      localStorage.setItem('just_logged_in', 'true')
      navigate(redirect, { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 403 && detail?.code === 'email_not_verified') {
        setEmailNotVerified(true)
        setError('Bitte bestätige zuerst deine Email.')
      } else {
        setError('E-Mail oder Passwort ist falsch.')
        setShake(true)
        setTimeout(() => setShake(false), 600)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    try {
      await client.post('/api/auth/resend-verification', { email })
      setResendSent(true)
    } catch {
      setResendSent(true)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <AuthShell
      icon="🍽️"
      title="PiEngines Recipes"
      subtitle="Melde dich an, um fortzufahren"
      shake={shake}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          id="email"
          label="Email oder Username"
          type="text"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
          required
          autoComplete="username"
          autoFocus
          trackId="login-email-input"
        />

        <Input
          id="password"
          label="Passwort"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          trackId="login-password-input"
        />

        {error && <p className="auth-msg auth-msg--error">{error}</p>}

        {emailNotVerified && !resendSent && (
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="auth-inline-btn"
              onClick={handleResend}
              disabled={resendLoading}
              data-track-id="login-resend-verification"
            >
              {resendLoading ? 'Wird gesendet …' : 'Neuen Bestätigungs-Link anfordern'}
            </button>
          </div>
        )}

        {resendSent && (
          <p className="auth-msg auth-msg--success">Neuer Link wurde gesendet.</p>
        )}

        <Button
          type="submit"
          variant="primary"
          full
          className="auth-submit"
          disabled={loading}
          trackId="login-form-submit"
        >
          {loading ? 'Wird angemeldet …' : 'Anmelden'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/forgot-password" className="auth-link auth-link--accent" data-track-id="login-forgot-link">
          Passwort vergessen?
        </Link>
        <Link to="/register" className="auth-link" data-track-id="login-register-link">
          Noch kein Konto? <strong>Registrieren</strong>
        </Link>
      </div>
    </AuthShell>
  )
}
