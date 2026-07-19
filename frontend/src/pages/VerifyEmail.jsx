import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import AuthShell from '../components/auth/AuthShell'
import { Button } from '../components/ui'

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

  if (state === 'loading') {
    return <AuthShell icon="⏳" title="Wird überprüft …" subtitle="Bitte warten." />
  }

  if (state === 'active') {
    return (
      <AuthShell
        icon="✅"
        title="Email bestätigt!"
        subtitle="Deine Email wurde bestätigt. Du kannst dich jetzt einloggen."
      >
        <div className="auth-links">
          <Button as={Link} to="/login" variant="primary" className="auth-submit" trackId="verify-login-link">
            Zur Anmeldung
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (state === 'pending') {
    return (
      <AuthShell
        icon="✉️"
        title="Email bestätigt"
        subtitle="Deine Email wurde bestätigt. Dein Konto wird noch vom Chefkoch freigeschaltet. Du erhältst eine Email, sobald dein Konto aktiviert wurde."
      >
        <div className="auth-links">
          <Button as={Link} to="/login" variant="primary" className="auth-submit" trackId="verify-login-link">
            Zur Anmeldung
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      icon="❌"
      title="Link ungültig"
      subtitle="Dieser Link ist abgelaufen oder ungültig. Bitte registriere dich erneut oder fordere einen neuen Link an."
    >
      <div className="auth-links">
        <Button as={Link} to="/register" variant="primary" className="auth-submit" trackId="verify-register-link">
          Zur Registrierung
        </Button>
      </div>
    </AuthShell>
  )
}
