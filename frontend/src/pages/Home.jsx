import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { RecipeCard, SkeletonCard } from './Recipes.jsx'

const RANDOM_CACHE_KEY = 'home_random_recipes'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour <= 11) return 'Guten Morgen'
  if (hour >= 12 && hour <= 17) return 'Guten Tag'
  if (hour >= 18 && hour <= 22) return 'Guten Abend'
  return 'Hallo'
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Carousel card ─────────────────────────────────────────────────────────────

function CarouselCard({ recipe, label, labelColor, onClick, trackId }) {
  if (!recipe) return null
  return (
    <div
      onClick={onClick}
      data-track-id={trackId}
      style={{
        flex: '0 0 260px',
        scrollSnapAlign: 'start',
        cursor: 'pointer',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--card)',
        height: '180px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundImage: 'linear-gradient(135deg, #C8602A 0%, #E8A07A 100%)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '0.625rem',
          left: '0.625rem',
          padding: '0.2rem 0.6rem',
          borderRadius: 'var(--radius-pill)',
          background: labelColor,
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
      <div style={{ position: 'relative', padding: '0.875rem 1rem' }}>
        <span style={{ color: '#fff', fontFamily: 'Playfair Display, serif', fontSize: '1.05rem', fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,0.45)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe.title}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { favorites } = useFavorites()

  const [randomRecipes, setRandomRecipes] = useState(null)
  const [discoverRecipe, setDiscoverRecipe] = useState(null)
  const [seasonalRecipe, setSeasonalRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const carouselRef = useRef(null)

  const favoriteRecipe = pickRandom(favorites)

  useEffect(() => {
    document.title = 'PiEngines Recipes'
  }, [])

  useEffect(() => {
    const cached = sessionStorage.getItem(RANDOM_CACHE_KEY)
    const randomReq = cached
      ? Promise.resolve({ data: JSON.parse(cached) })
      : client.get('/api/recipes/random', { params: { count: 3 } }).then(res => {
          sessionStorage.setItem(RANDOM_CACHE_KEY, JSON.stringify(res.data))
          return res
        })

    Promise.all([
      randomReq,
      client.get('/api/recipes/random', { params: { count: 1 } }),
      client.get('/api/recipes/random', { params: { count: 1 } }),
    ])
      .then(([randomRes, discoverRes, seasonalRes]) => {
        setRandomRecipes(randomRes.data)
        setDiscoverRecipe(discoverRes.data[0] ?? null)
        setSeasonalRecipe(seasonalRes.data[0] ?? null)
      })
      .catch(() => {
        setRandomRecipes([])
        setDiscoverRecipe(null)
        setSeasonalRecipe(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    if (loading) return
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % 3)
    }, 5000)
    return () => clearInterval(timer)
  }, [loading])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const cardWidth = 260 + 16 // card width + gap (1rem)
    el.scrollTo({ left: activeIndex * cardWidth, behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ margin: '0 0 1.5rem' }}>
          <div style={{ fontSize: '13px', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
            {getGreeting()}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: 'var(--text)', margin: 0 }}>
            {user?.username ? `${user.username}!` : 'Willkommen!'}
          </h1>
        </div>

        {/* ── Carousel ── */}
        <div
          ref={carouselRef}
          style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            paddingBottom: '0.5rem',
            marginBottom: '2.5rem',
          }}
        >
          {loading ? (
            <>
              <div style={{ flex: '0 0 260px', height: '180px' }}><SkeletonCard /></div>
              <div style={{ flex: '0 0 260px', height: '180px' }}><SkeletonCard /></div>
              <div style={{ flex: '0 0 260px', height: '180px' }}><SkeletonCard /></div>
            </>
          ) : (
            <>
              <CarouselCard
                recipe={seasonalRecipe}
                label="🌿 Saisonal"
                labelColor="rgba(107,124,78,0.8)"
                onClick={() => navigate('/seasonal')}
                trackId="home-carousel-seasonal-click"
              />
              <CarouselCard
                recipe={favoriteRecipe}
                label="❤️ Favorit"
                labelColor="rgba(200,96,42,0.8)"
                onClick={() => favoriteRecipe && navigate(`/recipes/${favoriteRecipe.id}`)}
                trackId="home-carousel-favorite-click"
              />
              <CarouselCard
                recipe={discoverRecipe}
                label="✨ Entdecken"
                labelColor="rgba(139,105,20,0.8)"
                onClick={() => discoverRecipe && navigate(`/recipes/${discoverRecipe.id}`)}
                trackId="home-carousel-discover-click"
              />
            </>
          )}
        </div>

        {/* ── Discover section ── */}
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', color: 'var(--text)', margin: '0 0 1rem' }}>
          Entdecke etwas Neues
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            {(randomRecipes || []).map(r => (
              <RecipeCard key={r.id} recipe={r} primaryImage={null} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <Link
            to="/recipes"
            data-track-id="home-all-recipes-click"
            style={{ color: 'var(--accent)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500, textDecoration: 'none' }}
          >
            Alle Rezepte →
          </Link>
        </div>
      </main>
    </div>
  )
}
