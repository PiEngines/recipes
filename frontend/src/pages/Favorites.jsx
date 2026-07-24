import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCollections } from '../api/collections'
import { useFavorites } from '../context/FavoritesContext'
import { SkeletonCard } from './Recipes.jsx'
import AccordionSection from '../components/AccordionSection'
import PostOverlay from '../components/PostOverlay'
import RecipeCard, { deletedCardProps } from '../components/RecipeCard'
import SammlungAccordion from '../components/SammlungAccordion'

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
  const navigate = useNavigate()
  const { favorites, favoriteIds, loading, removeFavorite } = useFavorites()

  // Sammlungen wie im Profil-„Gespeichert"-Tab: einmal laden, je Sammlung ein
  // einklappbarer Block. Ein Post-Overlay für die abspielbaren Beiträge.
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [offenerPost, setOffenerPost] = useState(null)
  // Entfernen-Geste (Ü27): removeFavorite räumt nur favoriteIds, nicht die
  // favorites-Liste — deshalb die entfernte Karte hier lokal ausblenden.
  const [removedIds, setRemovedIds] = useState(() => new Set())
  const entferneFavorit = (id) => {
    removeFavorite(id)
    setRemovedIds(prev => new Set(prev).add(id))
  }

  useEffect(() => {
    document.title = 'Meine Favoriten – PiEngines Recipes'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getCollections({ signal: controller.signal })
      .then(daten => setCollections(daten || []))
      .catch(() => {})
      .finally(() => setCollectionsLoading(false))
    return () => controller.abort()
  }, [])

  const busy = loading || collectionsLoading

  return (
    <div data-track-id="favorites-page" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {busy ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : favorites.length === 0 && collections.length === 0 ? (
          <EmptyFavoritesState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(() => {
              const sichtbareFavoriten = favorites.filter(r => !removedIds.has(r.id))
              return (
            <AccordionSection
              id="favorites-block"
              ariaLabel="Meine Favoriten"
              title="Favoriten"
              count={sichtbareFavoriten.length}
              trackId="favorites-block-toggle"
            >
              {sichtbareFavoriten.length === 0 ? (
                <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 }}>
                  Noch nichts favorisiert. Tippe auf das Herz eines Rezepts.
                </p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
                  {sichtbareFavoriten.map(r => (
                    <div key={r.id} data-track-id="favorites-recipe-card-click">
                      <RecipeCard recipe={r} dimmed={!favoriteIds.has(r.id)} onClick={() => navigate(`/recipes/${r.id}`)} {...(deletedCardProps(r) || {})} onRemove={r.purge_after ? () => entferneFavorit(r.id) : undefined} />
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>
              )
            })()}

            {collections.map(c => (
              <SammlungAccordion
                key={c.id}
                collection={c}
                onRecipeClick={id => navigate(`/recipes/${id}`)}
                onPostOpen={setOffenerPost}
              />
            ))}
          </div>
        )}

        {offenerPost && (
          <PostOverlay post={offenerPost} onClose={() => setOffenerPost(null)} />
        )}
      </main>
    </div>
  )
}
