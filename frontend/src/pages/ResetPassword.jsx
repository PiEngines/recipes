import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import AuthShell from '../components/auth/AuthShell'
import { Button, Input } from '../components/ui'

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
    <AuthShell
      icon="🔒"
      title="Neues Passwort"
      subtitle="Gib dein neues Passwort ein."
      shake={shake}
    >
      {success ? (
        <>
          <p className="auth-note auth-note--success">
            Passwort geändert. Du kannst dich jetzt anmelden.
          </p>
          <div className="auth-links">
            <Link to="/login" className="auth-link auth-link--accent" data-track-id="reset-login-link">
              Zur Anmeldung →
            </Link>
          </div>
        </>
      ) : expired ? (
        <>
          <p className="auth-note auth-note--error">
            Dieser Link ist abgelaufen.
          </p>
          <div className="auth-links">
            <Link to="/forgot-password" className="auth-link auth-link--accent" data-track-id="reset-new-link">
              Neuen Link anfordern →
            </Link>
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="rp-password"
            label="Neues Passwort (min. 8 Zeichen, 1 Zahl)"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            autoFocus
            trackId="reset-password-input"
          />

          <Input
            id="rp-password-confirm"
            label="Passwort bestätigen"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            trackId="reset-password-confirm-input"
          />

          {error && <p className="auth-msg auth-msg--error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            full
            className="auth-submit"
            disabled={loading}
            trackId="reset-form-submit"
          >
            {loading ? 'Wird gespeichert …' : 'Passwort speichern'}
          </Button>

          <div className="auth-links">
            <Link to="/login" className="auth-link" data-track-id="reset-back-login-link">
              ← Zurück zur Anmeldung
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
