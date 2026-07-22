import { Heart } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCollectionSheet } from '../context/CollectionSheetContext'
import { useFavorites } from '../context/FavoritesContext'
import { isKochOrAbove } from '../utils/roles'

// Crisp white outline around the icon silhouette (stacked zero-blur drop-shadows
// approximate a border, unlike a soft blurred drop-shadow)
const HEART_OUTLINE_FILTER = [
  [1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 var(--heart-outline))`).join(' ')

export default function FavoriteHeart({ recipeId, recipe, size = 22, outline = true, style = {}, trackId }) {
  const { user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const sheet = useCollectionSheet()
  const berechtigt = isKochOrAbove(user)

  // Sammlungen einmal pro Sitzung vorladen (der Provider entprellt das über
  // alle Herzen hinweg) — sonst klappt das Sheet beim Faven erst leer auf.
  useEffect(() => {
    if (berechtigt) sheet?.vorladen()
  }, [berechtigt, sheet])

  if (!berechtigt) return null

  const isFavorite = favoriteIds.has(recipeId)

  // Faven öffnet zusätzlich das „In Sammlung"-Sheet (BUG-05) — das Rezept ist
  // damit gemerkt *und* einsortierbar. Ent-faven bleibt ein reiner Toggle.
  const umschalten = () => {
    toggleFavorite(recipeId, recipe)
    if (!isFavorite) sheet?.oeffnen('recipe', recipeId)
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); umschalten() }}
      title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      data-track-id={trackId}
      style={{
        background: 'none',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        padding: '0.3rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Die Herzform ist oben-lastig (Spitze unten) — geometrisch zentriert wirkt
        // sie im runden Button zu hoch. 1px nach unten setzt sie optisch mittig.
        transform: 'translateY(1px)',
        filter: outline ? HEART_OUTLINE_FILTER : 'none',
        ...style,
      }}
    >
      <Heart size={size} fill={isFavorite ? '#C30000' : 'none'} color={isFavorite ? '#C30000' : '#555'} strokeWidth={2} />
    </button>
  )
}
