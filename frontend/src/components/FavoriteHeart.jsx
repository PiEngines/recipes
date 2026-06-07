import { Heart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { isKochOrAbove } from '../utils/roles'

export default function FavoriteHeart({ recipeId, size = 20, style = {} }) {
  const { user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()

  if (!isKochOrAbove(user)) return null

  const isFavorite = favoriteIds.has(recipeId)

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(recipeId) }}
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
        filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.95)) drop-shadow(0 0 2px rgba(255,255,255,0.95))',
        ...style,
      }}
    >
      <Heart size={size} fill={isFavorite ? '#E0392B' : 'none'} color={isFavorite ? '#E0392B' : '#fff'} strokeWidth={2} />
    </button>
  )
}
