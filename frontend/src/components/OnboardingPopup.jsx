import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function OnboardingPopup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    const done = localStorage.getItem('onboarding_done')
    const justLoggedIn = localStorage.getItem('just_logged_in')
    if (!done && justLoggedIn === 'true') {
      localStorage.removeItem('just_logged_in')
      setVisible(true)
    }
  }, [user])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem('onboarding_done', 'true')
    setVisible(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1rem' }}>
          Willkommen bei PiEngines Recipes! 🍽️
        </h2>
        <div style={{ color: 'var(--subtext)', lineHeight: 1.7, margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
          <p style={{ margin: '0 0 0.75rem' }}>Schön dass du dabei bist! Hier sind die wichtigsten Features:</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <li>🔍 Rezepte durchsuchen und entdecken</li>
            <li>⏱️ Timer direkt in den Zubereitungsschritten starten</li>
            <li>📸 Fotos zu Rezepten und Schritten hinzufügen</li>
            <li>🥄 Zutaten werden beim Kochen automatisch hervorgehoben</li>
            <li>📱 Funktioniert auch perfekt auf dem Handy</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0' }}>Starte am besten mit deinem Profil – dort kannst du deine Einstellungen anpassen.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => { dismiss(); navigate('/profile') }} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
            Zum Profil
          </button>
          <button onClick={dismiss} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.9rem' }}>
            Gleich loslegen
          </button>
        </div>
      </div>
    </div>
  )
}
