import { Heart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { isKochOrAbove } from '../utils/roles'

// Crisp white outline around the icon silhouette (stacked zero-blur drop-shadows
// approximate a border, unlike a soft blurred drop-shadow)
const HEART_OUTLINE_FILTER = [
  [1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 #fff)`).join(' ')

export default function FavoriteHeart({ recipeId, recipe, size = 20, outline = true, style = {} }) {
  const { user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()

  if (!isKochOrAbove(user)) return null

  const isFavorite = favoriteIds.has(recipeId)

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(recipeId, recipe) }}
      title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.3rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: outline ? HEART_OUTLINE_FILTER : 'none',
        ...style,
      }}
    >
      <Heart size={size} fill={isFavorite ? '#C30000' : 'none'} color={isFavorite ? '#C30000' : (outline ? '#fff' : 'rgba(255,255,255,0.85)')} strokeWidth={2} />
    </button>
  )
}
