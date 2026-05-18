import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function OnboardingPopup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    // Show if: triggered by registration (state.showOnboarding) OR first login (no key in localStorage)
    const done = localStorage.getItem('onboarding_done')
    const fromReg = location.state?.showOnboarding
    if (!done || fromReg) setVisible(true)
  }, [user])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem('onboarding_done', 'true')
    setVisible(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1rem' }}>
          Willkommen bei PiEngines Recipes! 🍽️
        </h2>
        <p style={{ color: 'var(--subtext)', lineHeight: 1.6, margin: '0 0 1.5rem', fontSize: '0.925rem' }}>
          Hier findest du alle Rezepte, kannst eigene erstellen und mit anderen teilen. Schau dir zuerst dein Profil an.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => { dismiss(); navigate('/profile') }} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
            Zum Profil
          </button>
          <button onClick={dismiss} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.9rem' }}>
            Später
          </button>
        </div>
      </div>
    </div>
  )
}
