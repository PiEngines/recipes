import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Heart } from 'lucide-react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { isChefkochOrAbove, isKochOrAbove } from '../utils/roles'
import FavoriteHeart from '../components/FavoriteHeart'
import AuthorLink from '../components/AuthorLink'

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

// Item 7: nur warme Töne
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #C8602A 0%, #E8A07A 100%)',  // Terrakotta
  'linear-gradient(135deg, #6B7C4E 0%, #9DB06F 100%)',  // Olivgrün
  'linear-gradient(135deg, #8B6914 0%, #C8A84B 100%)',  // Ocker
  'linear-gradient(135deg, #8B4513 0%, #C47A45 100%)',  // Rostbraun
  'linear-gradient(135deg, #C4A55A 0%, #E0C870 100%)',  // Sandgelb
]

function DifficultySpoons({ difficulty }) {
  const filled = difficulty
  return (
    <span title={`${difficulty}/5`} style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ display: 'inline-block', fontSize: '1rem', color: '#C8602A', opacity: i < filled ? 1 : 0.25, lineHeight: 1, transform: 'scaleX(-1)' }}>🥄</span>
      ))}
    </span>
  )
}

// ── Recipe card ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe, primaryImage, dimmed }) {
  const { user } = useAuth()
  const gradient = CARD_GRADIENTS[recipe.id % CARD_GRADIENTS.length]
  const isDraft = recipe.status === 'draft'

  const isPendingReview = recipe.review_status === 'pending'
  const blockClick = isPendingReview && !isChefkochOrAbove(user) && user?.id !== recipe.created_by

  const draftBadge = isDraft && (
    <span style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', padding: '0.2rem 0.55rem', background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', zIndex: 2 }}>
      Entwurf
    </span>
  )

  const pendingBadge = isPendingReview && (
    <span style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', padding: '0.2rem 0.55rem', background: 'rgba(200,160,32,0.9)', color: '#5a4400', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.02em', zIndex: 2 }}>
      Wird geprüft
    </span>
  )

  const titleSpan = (
    <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,0.45)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {recipe.title}
    </span>
  )

  const isBlurThumb = recipe.thumbnail_style === 'blur'

  const topArea = primaryImage ? (
    <div style={{ height: '180px', flexShrink: 0, position: 'relative', overflow: 'hidden', background: isBlurThumb ? 'var(--card)' : undefined }}>
      <div
        className="card-image-bg"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${primaryImage.thumbnail_url || primaryImage.url})`,
          backgroundSize: isBlurThumb ? 'contain' : 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transition: 'transform 0.3s ease',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.52) 0%, transparent 58%)' }} />
      {pendingBadge || draftBadge}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.875rem 1rem' }}>
        {titleSpan}
      </div>
    </div>
  ) : (
    <div style={{ background: gradient, height: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.875rem 1rem', position: 'relative' }}>
      {pendingBadge || draftBadge}
      {titleSpan}
    </div>
  )

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      style={{ textDecoration: 'none', display: 'block', color: 'inherit', height: '100%', opacity: dimmed ? 0.4 : isPendingReview ? 0.65 : 1, pointerEvents: dimmed ? 'none' : blockClick ? 'none' : 'auto' }}
      tabIndex={dimmed || blockClick ? -1 : 0}
    >
      <div className="recipe-card" style={{ height: '100%', minHeight: '280px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {topArea}
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.625rem', position: 'relative' }}>
          <FavoriteHeart recipeId={recipe.id} size={20} outline={false} style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', zIndex: 3, pointerEvents: 'auto' }} />
          <div style={{ flex: 1 }}>
            {recipe.description ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', paddingRight: '2rem' }}>
                {recipe.description}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--border-input)' }}>&nbsp;</p>
            )}
            {recipe.author && (
              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--subtext)' }}>
                von <AuthorLink author={recipe.author} style={{ fontSize: '0.75rem' }} />
              </p>
            )}
          </div>
          <div>
            {(recipe.prep_time || recipe.cook_time) && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
                {recipe.prep_time && (
                  <span style={{ padding: '0.2rem 0.55rem', background: 'rgba(200,96,42,0.1)', color: 'var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>⏱ {recipe.prep_time} min</span>
                )}
                {recipe.cook_time && (
                  <span style={{ padding: '0.2rem 0.55rem', background: 'rgba(107,124,78,0.12)', color: 'var(--secondary)', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>🍳 {recipe.cook_time} min</span>
                )}
              </div>
            )}
            {recipe.difficulty && <DifficultySpoons difficulty={recipe.difficulty} />}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="recipe-card skeleton" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="skeleton-block" style={{ height: '180px', flexShrink: 0 }} />
      <div style={{ padding: '1rem', flex: 1 }}>
        <div className="skeleton-block" style={{ height: '0.85rem', width: '90%', marginBottom: '0.5rem' }} />
        <div className="skeleton-block" style={{ height: '0.85rem', width: '65%', marginBottom: '0.875rem' }} />
        <div className="skeleton-block" style={{ height: '0.75rem', width: '55%', marginBottom: '0.625rem' }} />
        <div className="skeleton-block" style={{ height: '0.7rem', width: '70%' }} />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ search }) {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🥘</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>
        {search ? 'Keine Rezepte gefunden' : 'Noch keine Rezepte vorhanden'}
      </h3>
      <p style={{ margin: 0, fontSize: '0.925rem' }}>
        {search
          ? `Kein Ergebnis für „${search}". Versuche einen anderen Begriff.`
          : 'Hier erscheinen demnächst leckere Rezepte.'}
      </p>
    </div>
  )
}

function EmptyFavoritesState() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤍</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>
        Noch keine Favoriten
      </h3>
      <p style={{ margin: 0, fontSize: '0.925rem' }}>
        Markiere Rezepte mit dem Herz-Symbol, um sie hier wiederzufinden.
      </p>
    </div>
  )
}

// ── Deleted-favorite card ─────────────────────────────────────────────────────

function DeletedFavoriteCard({ recipe }) {
  const { removeFavorite } = useFavorites()
  return (
    <div className="recipe-card" style={{ height: '100%', minHeight: '280px', display: 'flex', flexDirection: 'column', opacity: 0.55, filter: 'grayscale(1)' }}>
      <div style={{ background: 'linear-gradient(135deg, #8a8a86 0%, #b6b6b2 100%)', height: '180px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '0.875rem 1rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe.title}
        </span>
      </div>
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)', fontStyle: 'italic' }}>
          Rezept nicht mehr verfügbar
        </p>
        <button
          onClick={() => removeFavorite(recipe.id)}
          style={{ alignSelf: 'flex-start', padding: '0.4rem 0.85rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--subtext)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', transition: 'var(--transition)' }}
        >
          Aus Favoriten entfernen
        </button>
      </div>
    </div>
  )
}

// ── Filter button ─────────────────────────────────────────────────────────────

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.5rem 1rem',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-input)'}`,
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--accent)' : 'var(--card)',
        color: active ? '#fff' : 'var(--text)',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'var(--transition)',
      }}
    >
      {children}
    </button>
  )
}

function AuthorFilterChip({ author, onClear }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0.5rem 0.5rem 1rem',
      border: '1.5px solid var(--border-input)',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--card)',
      color: 'var(--text)',
      fontFamily: 'Inter, sans-serif',
      fontSize: '0.875rem',
    }}>
      Autor: <strong>{author}</strong>
      <button
        onClick={onClear}
        title="Filter entfernen"
        aria-label="Filter entfernen"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem' }}
      >
        ✕
      </button>
    </span>
  )
}

// ── Pagination button ─────────────────────────────────────────────────────────

function PageBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: disabled ? 'transparent' : 'var(--card)', color: disabled ? 'var(--subtext)' : 'var(--text)', cursor: disabled ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', transition: 'var(--transition)' }}>
      {children}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Recipes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { favorites, favoriteIds } = useFavorites()

  const search = searchParams.get('q') || ''
  const scopeDesc = searchParams.get('scopeDesc') === '1'
  const scopeIng = searchParams.get('scopeIng') === '1'
  const scopeAuthor = searchParams.get('scopeAuthor') === '1'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const showFavorites = searchParams.get('favorites') === '1' && isKochOrAbove(user)
  const authorFilter = searchParams.get('author') || ''

  // Explicit author-link filter wins; otherwise "Nur nach Autor" turns the search box into a username search
  const effectiveAuthor = authorFilter || (scopeAuthor && search ? search : '')

  const [recipes, setRecipes]         = useState([])
  const [primaryImages, setPrimaryImages] = useState({})
  const [loading, setLoading]         = useState(true)
  const [total, setTotal]             = useState(0)

  useEffect(() => {
    let debounceTimer
    const handler = () => {
      if (window.location.pathname !== '/') return
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        sessionStorage.setItem('recipes_scroll_y', window.scrollY)
        sessionStorage.setItem('recipes_scroll_height', document.body.scrollHeight)
      }, 200)
    }
    window.addEventListener('scroll', handler)
    return () => {
      clearTimeout(debounceTimer)
      window.removeEventListener('scroll', handler)
    }
  }, [])

  useEffect(() => {
    setLoading(true)

    const loadPrimaryImages = (items) => Promise.all(
      items.map(r =>
        client.get(`/api/media/entity/recipe/${r.id}`)
          .then(({ data }) => ({ id: r.id, primary: data.find(m => m.is_primary && m.media_type === 'image') ?? null }))
          .catch(() => ({ id: r.id, primary: null }))
      )
    ).then(results => {
      const map = {}
      results.forEach(({ id, primary }) => { map[id] = primary })
      setPrimaryImages(map)
    })

    if (showFavorites) {
      let list = favorites
      if (effectiveAuthor) {
        const term = effectiveAuthor.toLowerCase()
        list = list.filter(r => r.author?.username?.toLowerCase().includes(term))
      } else if (search) {
        const term = search.toLowerCase()
        list = list.filter(r => r.title.toLowerCase().includes(term))
      }
      const start = (page - 1) * PAGE_SIZE
      const items = list.slice(start, start + PAGE_SIZE)
      setRecipes(items)
      setTotal(list.length)
      loadPrimaryImages(items.filter(r => !r.deleted_at)).finally(() => setLoading(false))
      return
    }

    const scopeParts = ['title']
    if (scopeDesc) scopeParts.push('description', 'steps')
    if (scopeIng) scopeParts.push('ingredients')
    const searchScope = scopeParts.join(',')
    const params = { page, page_size: PAGE_SIZE, search_scope: searchScope }
    if (effectiveAuthor) {
      params.author = effectiveAuthor
    } else if (search) {
      params.search = search
    }
    client.get('/api/recipes', { params })
      .then(res => {
        const items = res.data.items
        setRecipes(items)
        setTotal(res.data.total)
        loadPrimaryImages(items).then(() => {
          const savedY = sessionStorage.getItem('recipes_scroll_y')
          const savedH = sessionStorage.getItem('recipes_scroll_height')
          if (savedY !== null) {
            sessionStorage.removeItem('recipes_scroll_y')
            sessionStorage.removeItem('recipes_scroll_height')
            const y = parseInt(savedY, 10)
            const h = parseInt(savedH, 10)
            document.body.style.minHeight = h + 'px'
            window.scrollTo({ top: y, behavior: 'instant' })
            requestAnimationFrame(() => {
              document.body.style.minHeight = ''
            })
          }
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, scopeDesc, scopeIng, scopeAuthor, showFavorites, authorFilter, effectiveAuthor])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const setPage = (p) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    return next
  }, { replace: true })

  const toggleFavoritesFilter = () => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (showFavorites) next.delete('favorites')
    else next.set('favorites', '1')
    next.delete('page')
    return next
  }, { replace: true })

  const clearAuthorFilter = () => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.delete('author')
    next.delete('page')
    return next
  }, { replace: true })

  const showFilterBar = isKochOrAbove(user) || authorFilter

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {showFilterBar && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {isKochOrAbove(user) && (
              <FilterButton active={showFavorites} onClick={toggleFavoritesFilter}>
                <Heart size={16} fill={showFavorites ? '#fff' : 'none'} strokeWidth={2} />
                Favoriten
              </FilterButton>
            )}
            {authorFilter && <AuthorFilterChip author={authorFilter} onClear={clearAuthorFilter} />}
          </div>
        )}

        {!loading && total > 0 && (
          <p style={{ color: 'var(--subtext)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
            {total} Rezept{total !== 1 ? 'e' : ''}{search ? ` für „${search}"` : ''}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : recipes.length === 0 ? (
          showFavorites ? <EmptyFavoritesState /> : <EmptyState search={search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            {recipes.map(r => r.deleted_at
              ? <DeletedFavoriteCard key={r.id} recipe={r} />
              : <RecipeCard key={r.id} recipe={r} primaryImage={primaryImages[r.id] ?? null} dimmed={showFavorites && !favoriteIds.has(r.id)} />
            )}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
            <PageBtn onClick={() => setPage(page - 1)} disabled={page === 1}>← Zurück</PageBtn>
            <span style={{ color: 'var(--subtext)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Seite {page} / {totalPages}</span>
            <PageBtn onClick={() => setPage(page + 1)} disabled={page === totalPages}>Weiter →</PageBtn>
          </div>
        )}
      </main>
    </div>
  )
}
