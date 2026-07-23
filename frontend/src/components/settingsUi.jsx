// Wiederverwendbare Bausteine der Konto-/Einstellungsformulare.
//
// Herausgezogen, als die Kontoverwaltung aus dem Profil-Tab in die eigene
// Seite `Einstellungen` wanderte (BUG-41): Karte, Statusmeldung, Primärknopf,
// Umschalter lagen vorher lokal in `Profile.jsx`. Beide Flächen greifen jetzt
// auf dieselbe Quelle zu. Die geteilten Label-/Input-Stile liegen in
// `settingsStyles.js` — hier bleiben nur Komponenten, damit Fast Refresh greift.
import { useState } from 'react'

export function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1.25rem', color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

export function Msg({ type, children }) {
  const colors = { success: { bg: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)' }, error: { bg: 'var(--danger-tint)', color: 'var(--danger)' } }
  const c = colors[type] || colors.error
  return (
    <p style={{ margin: '0 0 1rem', padding: '0.625rem 0.875rem', background: c.bg, color: c.color, borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500 }}>
      {children}
    </p>
  )
}

export function PrimaryBtn({ type, loading, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type={type || 'button'}
      disabled={loading}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '0.65rem 1.5rem', background: loading ? 'color-mix(in srgb, var(--accent) 60%, #ffffff)' : hov ? 'var(--accent-hover)' : 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'background 0.15s' }}
    >
      {loading ? 'Wird gespeichert …' : children}
    </button>
  )
}

export function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{ width: '46px', height: '26px', borderRadius: '13px', background: checked ? 'var(--accent)' : 'var(--border-input)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}
