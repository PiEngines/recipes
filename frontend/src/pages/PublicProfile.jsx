import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import RecipeCard from '../components/RecipeCard'

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
        const items = Array.isArray(res.data.items) ? res.data.items : []
        setRecipes(items)
        if (items.length > 0 && items[0].author) setAuthor(items[0].author)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const initials = author?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <button onClick={() => navigate(-1)} data-track-id="public-profile-back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ← Zurück
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Wird geladen …</div>
        ) : (
          <>
            {/* Profil-Kopf (Wahl 2.0): dunkler Balken, Name Lora, Avatar — ohne Stats/Folgen (F3) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--ink-braun)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--on-dark)', opacity: 0.5 }}>Profil</p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--on-dark)', lineHeight: 1.05 }}>
                  {author?.name || `Benutzer #${id}`}
                </h1>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-dark)', opacity: 0.55 }}>
                  {recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''} veröffentlicht
                </p>
              </div>
            </div>

            {/* Rezepte-Grid via kanonischer RecipeCard */}
            {recipes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🥘</div>
                <p style={{ margin: 0 }}>Noch keine öffentlichen Rezepte vorhanden.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text)' }}>
                  Rezepte
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16, alignItems: 'stretch' }}>
                  {recipes.map(r => (
                    <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipes/${r.id}`)} />
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
