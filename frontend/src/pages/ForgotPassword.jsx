import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import AuthShell from '../components/auth/AuthShell'
import { Button, Input } from '../components/ui'

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
    <AuthShell
      icon="🔑"
      title="Passwort vergessen"
      subtitle="Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen."
    >
      {submitted ? (
        <>
          <p className="auth-note auth-note--success">
            Falls diese E-Mail-Adresse registriert ist, erhältst du in Kürze eine Nachricht mit einem Link zum Zurücksetzen.
          </p>
          <div className="auth-links">
            <Link to="/login" className="auth-link auth-link--accent" data-track-id="forgot-back-login-link">
              ← Zurück zur Anmeldung
            </Link>
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="fp-email"
            label="E-Mail-Adresse"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="du@beispiel.de"
            required
            autoComplete="email"
            autoFocus
            trackId="forgot-email-input"
          />

          <Button
            type="submit"
            variant="primary"
            full
            className="auth-submit"
            disabled={loading}
            trackId="forgot-form-submit"
          >
            {loading ? 'Wird gesendet …' : 'Link anfordern'}
          </Button>

          <div className="auth-links">
            <Link to="/login" className="auth-link" data-track-id="forgot-back-login-link">
              ← Zurück zur Anmeldung
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
