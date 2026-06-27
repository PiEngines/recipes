import { useNavigate } from 'react-router-dom'

export default function Fratcher() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 56, marginBottom: '1.25rem' }}>🥦</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--text)', margin: '0 0 0.75rem' }}>
          Kühlschrank-Check
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, margin: '0 0 1.75rem' }}>
          Finde Rezepte mit dem, was du zuhause hast. Diese Funktion ist gerade in Entwicklung.
        </p>
        <button
          onClick={() => navigate('/recipes')}
          data-track-id="fratcher-back-to-recipes"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-pill)', padding: '0.65rem 1.5rem',
            fontSize: '0.9rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          <i className="ti ti-book-2" style={{ fontSize: 16 }} />
          Alle Rezepte
        </button>
      </div>
    </div>
  )
}
