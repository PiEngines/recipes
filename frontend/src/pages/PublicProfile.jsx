import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #C8602A 0%, #E8A07A 100%)',
  'linear-gradient(135deg, #6B7C4E 0%, #9DB06F 100%)',
  'linear-gradient(135deg, #8B6914 0%, #C8A84B 100%)',
  'linear-gradient(135deg, #8B4513 0%, #C47A45 100%)',
  'linear-gradient(135deg, #C4A55A 0%, #E0C870 100%)',
]

export default function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [author, setAuthor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    client.get('/api/recipes', { params: { author_id: id, page_size: 50, page: 1 } })
      .then(res => {
        const items = res.data.items
        setRecipes(items)
        if (items.length > 0 && items[0].author) {
          setAuthor(items[0].author)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const initials = author?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ← Zurück
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Wird geladen …</div>
        ) : (
          <>
            {/* Profile header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.375rem', color: 'var(--text)' }}>
                  {author?.name || `Benutzer #${id}`}
                </h1>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                  {recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''} veröffentlicht
                </p>
              </div>
            </div>

            {/* Recipes grid */}
            {recipes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🥘</div>
                <p style={{ margin: 0 }}>Noch keine öffentlichen Rezepte vorhanden.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text)' }}>
                  Rezepte
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
                  {recipes.map(r => (
                    <MiniRecipeCard key={r.id} recipe={r} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MiniRecipeCard({ recipe }) {
  const gradient = CARD_GRADIENTS[recipe.id % CARD_GRADIENTS.length]
  return (
    <Link to={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', display: 'block', color: 'inherit', height: '100%' }}>
      <div className="recipe-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ background: gradient, height: '150px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.875rem 1rem', position: 'relative' }}>
          <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,0.45)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {recipe.title}
          </span>
        </div>
        <div style={{ padding: '0.875rem 1rem', flex: 1, background: 'var(--card)' }}>
          {recipe.description && (
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--subtext)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {recipe.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {recipe.prep_time && (
              <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(200,96,42,0.1)', color: 'var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500 }}>⏱ {recipe.prep_time} min</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
