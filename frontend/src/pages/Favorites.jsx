import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { RecipeCard, SkeletonCard } from './Recipes.jsx'

function EmptyFavoritesState() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤍</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>
        Noch keine Favoriten gemerkt.
      </h3>
      <Link
        to="/recipes"
        data-track-id="favorites-empty-discover-click"
        style={{ color: 'var(--accent)', fontSize: '0.925rem', fontFamily: 'Inter, sans-serif', textDecoration: 'none', fontWeight: 500 }}
      >
        Alle Rezepte entdecken
      </Link>
    </div>
  )
}

export default function Favorites() {
  const { favorites, loading } = useFavorites()

  useEffect(() => {
    document.title = 'Meine Favoriten – PiEngines Recipes'
  }, [])

  return (
    <div data-track-id="favorites-page" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : favorites.length === 0 ? (
          <EmptyFavoritesState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            {favorites.map(r => (
              <div key={r.id} data-track-id="favorites-recipe-card-click">
                <RecipeCard recipe={r} primaryImage={null} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
