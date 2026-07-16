import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import BackButton from '../components/BackButton'

// Deterministischer Gradient-Fallback (on-brand, wie in RecipeCard.jsx).
const CARD_GRADIENTS = [
  'linear-gradient(148deg, #A85A28 0%, #6B3510 100%)',
  'linear-gradient(148deg, #5C3A1E 0%, #8B6540 100%)',
  'linear-gradient(148deg, #B09A3E 0%, #7A6A1A 100%)',
  'linear-gradient(148deg, #3D4F25 0%, #6B7C4E 100%)',
  'linear-gradient(148deg, #6B5A3E 0%, #3E3020 100%)',
  'linear-gradient(148deg, #8A3E18 0%, #C47040 100%)',
]
const gradientFor = (id) => CARD_GRADIENTS[(id ?? 0) % CARD_GRADIENTS.length]

export default function Categories() {
  const navigate = useNavigate()
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Kategorien – PiEngines Recipes'
    client.get('/api/categories')
      .then(({ data }) => setCats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton fallback="/" />
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>
          Kategorien
        </h1>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ aspectRatio: '3 / 2', borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : cats.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Noch keine Kategorien vorhanden.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/recipes?category=${c.id}`)}
                data-track-id="categories-tile-click"
                style={{ position: 'relative', aspectRatio: '3 / 2', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: 'none', cursor: 'pointer', background: gradientFor(c.id), textAlign: 'left', boxShadow: 'var(--shadow)' }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.45) 0%, transparent 60%)' }} />
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    {c.recipe_count} Rezept{c.recipe_count === 1 ? '' : 'e'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
