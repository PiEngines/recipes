import { useState } from 'react'

const UNITS = ['g', 'kg', 'ml', 'l', 'EL', 'TL', 'Stück', 'Prise', 'Bund', 'Scheibe', 'Dose', 'Packung', 'nach Geschmack']

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  border: '1.5px solid var(--border-input)',
  borderRadius: '8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.875rem',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary = {
  flex: 1,
  padding: '0.6rem',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 600,
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
}

const btnSecondary = {
  flex: 1,
  padding: '0.6rem',
  borderRadius: '8px',
  border: '1.5px solid var(--border-input)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.9rem',
  fontWeight: 500,
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
}

export default function StepSuggestionDialog({ suggestion, saving, onAccept, onDismiss, onClose }) {
  const [name, setName] = useState(suggestion.bls_name)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState(null)

  const handleAccept = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name darf nicht leer sein')
      return
    }
    const qty = Number(quantity)
    if (quantity === '' || Number.isNaN(qty) || qty <= 0) {
      setError('Bitte eine gültige Menge angeben')
      return
    }
    setError(null)
    onAccept({ name: trimmedName, quantity: qty, unit: unit || null })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px', background: 'var(--card)', borderRadius: '12px',
          border: '1px solid var(--border-input)', padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)', fontFamily: 'Inter, sans-serif',
        }}
      >
        <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text)' }}>
          <strong>{suggestion.bls_name}</strong> wurde in diesem Schritt gefunden – möchtest du diese Zutat zur Rezeptliste hinzufügen?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name *"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Menge *"
              style={{ ...inputStyle, flex: '1 1 80px' }}
            />
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              style={{ ...inputStyle, flex: '1 1 100px' }}
            >
              <option value="">Einheit</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button onClick={onDismiss} disabled={saving} style={{ ...btnSecondary, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>
            Überspringen
          </button>
          <button onClick={handleAccept} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}
