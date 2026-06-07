import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from './AuthContext'
import { isKochOrAbove } from '../utils/roles'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const eligible = isKochOrAbove(user)

  const [favorites, setFavorites] = useState([])
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!eligible) {
      setFavorites([])
      setFavoriteIds(new Set())
      return
    }
    setLoading(true)
    client.get('/api/favorites')
      .then(res => {
        setFavorites(res.data)
        setFavoriteIds(new Set(res.data.map(r => r.id)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eligible])

  useEffect(() => { refresh() }, [refresh])

  const removeFavorite = useCallback(async (recipeId) => {
    setFavoriteIds(prev => {
      const next = new Set(prev)
      next.delete(recipeId)
      return next
    })
    setFavorites(prev => prev.filter(r => r.id !== recipeId))
    try {
      await client.delete(`/api/favorites/${recipeId}`)
    } catch {
      refresh()
    }
  }, [refresh])

  const addFavorite = useCallback(async (recipeId) => {
    setFavoriteIds(prev => new Set(prev).add(recipeId))
    try {
      await client.post(`/api/favorites/${recipeId}`)
      refresh()
    } catch {
      setFavoriteIds(prev => {
        const next = new Set(prev)
        next.delete(recipeId)
        return next
      })
    }
  }, [refresh])

  const toggleFavorite = useCallback((recipeId) => {
    if (favoriteIds.has(recipeId)) return removeFavorite(recipeId)
    return addFavorite(recipeId)
  }, [favoriteIds, removeFavorite, addFavorite])

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteIds, loading, toggleFavorite, addFavorite, removeFavorite, refresh }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
