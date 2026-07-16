import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart } from 'lucide-react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { isChefkochOrAbove, isKochOrAbove } from '../utils/roles'
import FavoriteHeart from '../components/FavoriteHeart'
import AuthorLink from '../components/AuthorLink'
import CanonicalRecipeCard from '../components/RecipeCard'
import BackButton from '../components/BackButton'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #C8602A 0%, #E8A07A 100%)',
  'linear-gradient(135deg, #6B7C4E 0%, #9DB06F 100%)',
  'linear-gradient(135deg, #8B6914 0%, #C8A84B 100%)',
  'linear-gradient(135deg, #8B4513 0%, #C47A45 100%)',
  'linear-gradient(135deg, #C4A55A 0%, #E0C870 100%)',
]

// Sort-Dropdown → Server-`sort` (Client-Sort entfällt; Reihenfolge kommt vom Server).
const SORT_OPTIONS = [
  { value: 'default', label: 'Standard' },   // kein Param
  { value: 'newest', label: 'Neueste' },
  { value: 'oldest', label: 'Älteste' },
  { value: 'rating', label: 'Bewertung' },
  { value: 'time_asc', label: 'Kochzeit' },
]
const SERVER_SORTS = new Set(['newest', 'oldest', 'rating', 'time_asc'])

const TYPE_OPTS = [
  { value: 'kochen', label: 'Kochen' },
  { value: 'backen', label: 'Backen' },
]
const ZEIT_OPTS = [
  { value: 30, label: 'Bis 30 Min.' },
  { value: 60, label: 'Bis 60 Min.' },
]
const DIFFICULTY_OPTS = [
  { value: 1, label: 'Sehr einfach' },
  { value: 2, label: 'Einfach' },
  { value: 3, label: 'Mittel' },
  { value: 4, label: 'Schwer' },
  { value: 5, label: 'Sehr schwer' },
]

const DIFF_LABELS = { 1: 'Sehr einfach', 2: 'Einfach', 3: 'Mittel', 4: 'Schwer', 5: 'Sehr schwer' }

// ── Legacy card (weiterhin von Favorites.jsx importiert — Signatur bewahren) ──

export function RecipeCard({ recipe, primaryImage, dimmed }) {
  const { user } = useAuth()
  const gradient = CARD_GRADIENTS[recipe.id % CARD_GRADIENTS.length]
  const isPendingReview = recipe.review_status === 'pending'
  const blockClick = isPendingReview && !isChefkochOrAbove(user) && user?.id !== recipe.created_by

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
      <div className="card-image-bg" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${primaryImage.thumbnail_url || primaryImage.url})`, backgroundSize: isBlurThumb ? 'contain' : 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', transition: 'transform 0.3s ease' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.52) 0%, transparent 58%)' }} />
      {pendingBadge}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.875rem 1rem' }}>{titleSpan}</div>
    </div>
  ) : (
    <div style={{ background: gradient, height: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.875rem 1rem', position: 'relative' }}>
      {pendingBadge}
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
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.625rem', position: 'relative', background: 'rgba(255,255,255,0.88)' }}>
          <FavoriteHeart recipeId={recipe.id} recipe={recipe} size={20} outline={false} style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', zIndex: 3, pointerEvents: 'auto' }} />
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
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              {(recipe.prep_time || recipe.cook_time) && (
                <span style={{ padding: '0.2rem 0.55rem', background: 'rgba(200,96,42,0.1)', color: 'var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  ⏱ {recipe.prep_time && recipe.cook_time
                    ? `${recipe.prep_time} + ${recipe.cook_time} Min.`
                    : `${recipe.prep_time || recipe.cook_time} Min.`}
                </span>
              )}
              <span style={{ padding: '0.2rem 0.55rem', background: 'rgba(107,124,78,0.12)', color: '#6B7C4E', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {recipe.type === 'backen' ? 'Backen' : 'Kochen'}
              </span>
            </div>
            {recipe.difficulty && (
              <span style={{ padding: '0.2rem 0.55rem', background: 'rgba(107,124,78,0.12)', color: '#6B7C4E', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {DIFF_LABELS[recipe.difficulty] ?? `Stufe ${recipe.difficulty}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function SkeletonCard() {
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

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ search, hasActiveFilters, onClearFilters }) {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🥘</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>
        {search || hasActiveFilters ? 'Keine Treffer' : 'Noch keine Rezepte vorhanden'}
      </h3>
      <p style={{ margin: 0, fontSize: '0.925rem' }}>
        {search || hasActiveFilters
          ? 'Keine Rezepte für diese Kombination.'
          : 'Hier erscheinen demnächst leckere Rezepte.'}
      </p>
      {hasActiveFilters && (
        <p style={{ margin: '1rem 0 0', fontSize: '0.875rem' }}>
          Einzelne Filter oben per ✕ entfernen — gedämpfte Optionen (0) grenzen zu stark ein.{' '}
          <button onClick={onClearFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', fontWeight: 500, textDecoration: 'underline', padding: 0 }}>
            Alle Filter zurücksetzen
          </button>
        </p>
      )}
    </div>
  )
}

function EmptyFavoritesState() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤍</div>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>Noch keine Favoriten</h3>
      <p style={{ margin: 0, fontSize: '0.925rem' }}>Markiere Rezepte mit dem Herz-Symbol, um sie hier wiederzufinden.</p>
    </div>
  )
}

function DeletedFavoriteCard({ recipe }) {
  const { removeFavorite } = useFavorites()
  return (
    <div className="recipe-card" style={{ height: '100%', minHeight: '260px', display: 'flex', flexDirection: 'column', opacity: 0.55, filter: 'grayscale(1)' }}>
      <div style={{ background: 'linear-gradient(135deg, #8a8a86 0%, #b6b6b2 100%)', aspectRatio: '4 / 3', flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '0.875rem 1rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe.title}
        </span>
      </div>
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)', fontStyle: 'italic' }}>Rezept nicht mehr verfügbar</p>
        <button onClick={() => removeFavorite(recipe.id)}
          style={{ alignSelf: 'flex-start', padding: '0.4rem 0.85rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--subtext)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', transition: 'var(--transition)' }}>
          Aus Favoriten entfernen
        </button>
      </div>
    </div>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.5rem 1rem',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-input)'}`,
      borderRadius: 'var(--radius-pill)',
      background: active ? 'var(--accent)' : 'var(--card)',
      color: active ? '#fff' : 'var(--text)',
      cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500, transition: 'var(--transition)',
    }}>
      {children}
    </button>
  )
}

function AuthorFilterChip({ author, onClear }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.5rem 0.5rem 1rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
      Autor: <strong>{author}</strong>
      <button onClick={onClear} title="Filter entfernen" aria-label="Filter entfernen"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem' }}>
        ✕
      </button>
    </span>
  )
}

// ── Filter panel (shared: desktop sidebar + mobile sheet) ─────────────────────

function FilterPill({ active, count, onClick, children }) {
  // count === undefined → keine Zähl-Anzeige (nicht-zählbare Facette).
  const disabled = count === 0 && !active
  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-pressed={active}
      disabled={disabled}
      style={{
        cursor: disabled ? 'default' : 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif',
        borderRadius: 'var(--radius-pill)', padding: '7px 13px',
        border: `1px solid ${active ? 'rgba(200,96,42,.35)' : 'var(--border-input)'}`,
        background: active ? 'rgba(200,96,42,.10)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        opacity: disabled ? 0.4 : 1,
        transition: 'var(--transition)',
      }}
    >
      {children}{count !== undefined && <span style={{ opacity: 0.65, marginLeft: 5 }}>({count})</span>}
    </button>
  )
}

function FilterPanel({ groups }) {
  return (
    <nav aria-label="Filter" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {groups.map(g => (
        g.opts.length === 0 ? null : (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
              {g.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {g.opts.map(o => (
                <FilterPill key={o.key} active={o.active} count={o.count} onClick={o.toggle}>{o.label}</FilterPill>
              ))}
            </div>
          </div>
        )
      ))}
    </nav>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Recipes() {
  const navigate = useNavigate()
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
  const authorIdFilter = searchParams.get('author_id') || null
  const typeFilters = new Set((searchParams.get('type') || '').split(',').filter(Boolean))
  const dietFilters = new Set((searchParams.get('diet') || '').split(',').filter(Boolean))
  const courseFilters = new Set((searchParams.get('course') || '').split(',').filter(Boolean))
  const difficultyFilters = new Set((searchParams.get('difficulty') || '').split(',').filter(Boolean))
  const categoryFilters = new Set((searchParams.get('category') || '').split(',').filter(Boolean))
  const maxTimeFilter = parseInt(searchParams.get('max_time') || '0', 10)
  const sort = searchParams.get('sort') || 'default'

  // Keys for the fetch effect dependency array (Sets are new refs every render).
  const typeKey = searchParams.get('type') || ''
  const dietKey = searchParams.get('diet') || ''
  const courseKey = searchParams.get('course') || ''
  const difficultyKey = searchParams.get('difficulty') || ''
  const categoryKey = searchParams.get('category') || ''

  const effectiveAuthor = authorFilter || (scopeAuthor && search ? search : '')

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState({})           // {diet:{id:count}, course:{value:count}, difficulty:{level:count}, category:{id:count}}
  const [dietOpts, setDietOpts] = useState([])       // [{ id, name }]
  const [courseOpts, setCourseOpts] = useState([])   // [string]
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Option-Listen (einmalig)
  useEffect(() => {
    client.get('/api/diet-labels').then(({ data }) => setDietOpts(data)).catch(() => {})
    client.get('/api/courses').then(({ data }) => setCourseOpts(data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)

    if (showFavorites) {
      let list = favorites
      if (effectiveAuthor) {
        const term = effectiveAuthor.toLowerCase()
        list = list.filter(r => r.author?.username?.toLowerCase().includes(term))
      } else if (search) {
        const term = search.toLowerCase()
        list = list.filter(r => r.title.toLowerCase().includes(term))
      }
      if (typeFilters.size > 0 && typeFilters.size < 3) list = list.filter(r => typeFilters.has(r.type || 'kochen'))
      const start = (page - 1) * PAGE_SIZE
      setRecipes(list.slice(start, start + PAGE_SIZE))
      setTotal(list.length)
      setFacets({}) // Favoriten sind client-seitig → keine Server-Facetten
      setLoading(false)
      return
    }

    const scopeParts = ['title']
    if (scopeDesc) scopeParts.push('description', 'steps')
    if (scopeIng) scopeParts.push('ingredients')
    const params = { page, page_size: PAGE_SIZE, search_scope: scopeParts.join(',') }
    if (authorIdFilter) params.author_id = authorIdFilter
    else if (effectiveAuthor) params.author = effectiveAuthor
    else if (search) params.search = search
    if (typeFilters.size === 1) params.type = [...typeFilters][0]
    else if (typeFilters.size > 1) params.type = [...typeFilters].sort().join(',')
    if (dietFilters.size) params.diet = [...dietFilters]
    if (courseFilters.size) params.course = [...courseFilters]
    if (difficultyFilters.size) params.difficulty = [...difficultyFilters]
    if (categoryFilters.size) params.category = [...categoryFilters]
    if (maxTimeFilter) params.max_time = maxTimeFilter
    if (SERVER_SORTS.has(sort)) params.sort = sort

    client.get('/api/recipes', { params, paramsSerializer: { indexes: null } })
      .then(res => {
        setRecipes(res.data.items)
        setTotal(res.data.total)
        setFacets(res.data.facets || {})
        // Scroll-Restore nach Rückkehr aus dem Detail
        const savedY = sessionStorage.getItem('recipes_scroll_y')
        const savedH = sessionStorage.getItem('recipes_scroll_height')
        if (savedY !== null) {
          sessionStorage.removeItem('recipes_scroll_y')
          sessionStorage.removeItem('recipes_scroll_height')
          document.body.style.minHeight = parseInt(savedH, 10) + 'px'
          window.scrollTo({ top: parseInt(savedY, 10), behavior: 'instant' })
          requestAnimationFrame(() => { document.body.style.minHeight = '' })
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, scopeDesc, scopeIng, scopeAuthor, showFavorites, authorFilter, authorIdFilter, effectiveAuthor, typeKey, dietKey, courseKey, difficultyKey, categoryKey, maxTimeFilter, sort, reloadNonce])

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

  const toggleTypeFilter = (t) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    const current = new Set((prev.get('type') || '').split(',').filter(Boolean))
    if (current.has(t)) current.delete(t)
    else current.add(t)
    if (current.size === 0) next.delete('type')
    else next.set('type', [...current].sort().join(','))
    next.delete('page')
    return next
  }, { replace: true })

  // Generischer Multi-Toggle (diet/course/category) — comma-joined in der URL.
  const toggleMulti = (key, val) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    const current = new Set((prev.get(key) || '').split(',').filter(Boolean))
    if (current.has(val)) current.delete(val)
    else current.add(val)
    if (current.size === 0) next.delete(key)
    else next.set(key, [...current].join(','))
    next.delete('page')
    return next
  }, { replace: true })

  const toggleTimeFilter = (t) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (maxTimeFilter === t) next.delete('max_time')
    else next.set('max_time', String(t))
    next.delete('page')
    return next
  }, { replace: true })

  const clearAllFilters = () => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    for (const k of ['type', 'diet', 'course', 'difficulty', 'max_time', 'category', 'page']) next.delete(k)
    return next
  }, { replace: true })

  const setSort = (val) => setSearchParams(prev => {
    const p = new URLSearchParams(prev)
    if (val === 'default') p.delete('sort')
    else p.set('sort', val)
    p.delete('page')
    return p
  }, { replace: true })

  // Facet-Count-Lookup (fehlende Optionen → 0; das ist die Zero-Result-Diagnose).
  const facetCount = (dim, key) => facets?.[dim]?.[String(key)] ?? 0

  // Filtergruppen für Sidebar + Sheet
  // Zählbare Facetten (diet/course/difficulty) tragen `count`; type/Zeit nicht.
  const groups = [
    {
      label: 'Art',
      opts: TYPE_OPTS.map(o => ({ key: 'type-' + o.value, label: o.label, active: typeFilters.has(o.value), toggle: () => toggleTypeFilter(o.value) })),
    },
    {
      label: 'Ernährung',
      opts: dietOpts.map(d => ({ key: 'diet-' + d.id, label: d.name, active: dietFilters.has(String(d.id)), count: facetCount('diet', d.id), toggle: () => toggleMulti('diet', String(d.id)) })),
    },
    {
      label: 'Gang',
      opts: courseOpts.map(c => ({ key: 'course-' + c, label: c, active: courseFilters.has(c), count: facetCount('course', c), toggle: () => toggleMulti('course', c) })),
    },
    {
      label: 'Schwierigkeit',
      opts: DIFFICULTY_OPTS.map(o => ({ key: 'diff-' + o.value, label: o.label, active: difficultyFilters.has(String(o.value)), count: facetCount('difficulty', o.value), toggle: () => toggleMulti('difficulty', String(o.value)) })),
    },
    {
      label: 'Zeitaufwand',
      opts: ZEIT_OPTS.map(o => ({ key: 'time-' + o.value, label: o.label, active: maxTimeFilter === o.value, toggle: () => toggleTimeFilter(o.value) })),
    },
  ]

  // Aktive Filter-Chips
  const chips = [
    ...[...typeFilters].map(t => ({ key: 'type-' + t, label: t === 'kochen' ? 'Kochen' : 'Backen', remove: () => toggleTypeFilter(t) })),
    ...[...dietFilters].map(id => ({ key: 'diet-' + id, label: dietOpts.find(d => String(d.id) === id)?.name || 'Ernährung', remove: () => toggleMulti('diet', id) })),
    ...[...courseFilters].map(c => ({ key: 'course-' + c, label: c, remove: () => toggleMulti('course', c) })),
    ...[...difficultyFilters].map(v => ({ key: 'diff-' + v, label: DIFFICULTY_OPTS.find(o => String(o.value) === v)?.label || `Stufe ${v}`, remove: () => toggleMulti('difficulty', v) })),
    ...(maxTimeFilter ? [{ key: 'time', label: `Bis ${maxTimeFilter} Min.`, remove: () => toggleTimeFilter(maxTimeFilter) }] : []),
    ...[...categoryFilters].map(id => ({ key: 'cat-' + id, label: 'Kategorie', remove: () => toggleMulti('category', id) })),
  ]
  const activeFilterCount = typeFilters.size + dietFilters.size + courseFilters.size + difficultyFilters.size + categoryFilters.size + (maxTimeFilter ? 1 : 0)

  const openDetail = (r) => {
    sessionStorage.setItem('recipes_scroll_y', window.scrollY)
    sessionStorage.setItem('recipes_scroll_height', document.body.scrollHeight)
    navigate(`/recipes/${r.id}`)
  }

  const renderGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 20, alignItems: 'stretch' }}>
      {recipes.map(r => r.deleted_at
        ? <DeletedFavoriteCard key={r.id} recipe={r} />
        : (
          <div key={r.id} style={{ opacity: showFavorites && !favoriteIds.has(r.id) ? 0.4 : 1, pointerEvents: showFavorites && !favoriteIds.has(r.id) ? 'none' : 'auto' }}>
            <CanonicalRecipeCard recipe={r} onClick={() => openDetail(r)} />
          </div>
        )
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton fallback="/" />
        </div>

        <div className="md:grid md:items-start" style={{ gridTemplateColumns: '264px 1fr', gap: 32 }}>

          {/* Sidebar (Desktop) */}
          <aside className="hidden md:block" style={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: 18, color: 'var(--text)' }}>Filter</div>
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Zurücksetzen
                  </button>
                )}
              </div>
              <FilterPanel groups={groups} />
            </div>
          </aside>

          {/* Results column */}
          <div style={{ minWidth: 0 }}>

            {/* Toolbar: mobile filter btn + favorites/author + count + sort */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <button
                className="md:hidden"
                onClick={() => setSheetOpen(true)}
                data-track-id="recipes-filter-sheet-open"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--card)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-pill)', padding: '9px 16px', fontFamily: 'Inter, sans-serif' }}
              >
                <i className="ti ti-adjustments-horizontal" style={{ fontSize: 16 }} />
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>

              {isKochOrAbove(user) && (
                <FilterButton active={showFavorites} onClick={toggleFavoritesFilter}>
                  <Heart size={16} fill={showFavorites ? '#fff' : 'none'} strokeWidth={2} />
                  Favoriten
                </FilterButton>
              )}
              {authorFilter && <AuthorFilterChip author={authorFilter} onClear={clearAuthorFilter} />}

              <div style={{ flex: 1 }} />

              {!loading && total > 0 && (
                <span aria-live="polite" style={{ fontSize: 14, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                  {total} Treffer
                </span>
              )}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                Sortieren
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  data-track-id="recipes-sort-select"
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)', background: 'var(--card)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-input)', padding: '8px 12px', cursor: 'pointer' }}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>

            {/* Active filter chips */}
            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {chips.map(c => (
                  <button
                    key={c.key}
                    onClick={c.remove}
                    aria-label={`Filter ${c.label} entfernen`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', color: 'var(--accent)', background: 'rgba(200,96,42,.10)', border: '1px solid rgba(200,96,42,.3)', borderRadius: 'var(--radius-pill)', padding: '7px 12px' }}
                  >
                    {c.label}
                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
                  </button>
                ))}
                <button onClick={clearAllFilters} style={{ cursor: 'pointer', fontSize: 13, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', background: 'transparent', border: 'none', textDecoration: 'underline' }}>
                  Alle zurücksetzen
                </button>
              </div>
            )}

            {/* Error banner (Filter bleiben erhalten) */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(200,96,42,.08)', border: '1px solid rgba(200,96,42,.3)', borderRadius: 'var(--radius-card)', padding: '12px 16px', marginBottom: 20, fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)' }}>
                <span>Rezepte konnten nicht geladen werden.</span>
                <button onClick={() => setReloadNonce(n => n + 1)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                  Erneut versuchen
                </button>
              </div>
            )}

            {/* Grid / States */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 20, alignItems: 'stretch' }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : recipes.length === 0 ? (
              showFavorites
                ? <EmptyFavoritesState />
                : <EmptyState search={search} hasActiveFilters={activeFilterCount > 0} onClearFilters={clearAllFilters} />
            ) : renderGrid()}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1}
                  style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: page === 1 ? 'transparent' : 'var(--card)', color: page === 1 ? 'var(--subtext)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', transition: 'var(--transition)' }}>
                  ← Zurück
                </button>
                <span style={{ color: 'var(--subtext)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Seite {page} / {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
                  style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: page === totalPages ? 'transparent' : 'var(--card)', color: page === totalPages ? 'var(--subtext)' : 'var(--text)', cursor: page === totalPages ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', transition: 'var(--transition)' }}>
                  Weiter →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '84%', maxWidth: 340, background: 'var(--bg)', boxShadow: '4px 0 24px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: 18, color: 'var(--text)' }}>Filter</div>
              <button onClick={() => setSheetOpen(false)} aria-label="Schließen" style={{ background: 'none', border: 'none', color: 'var(--subtext)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <FilterPanel groups={groups} />
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <button onClick={clearAllFilters} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500 }}>
                Zurücksetzen
              </button>
              <button onClick={() => setSheetOpen(false)} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 'var(--radius-pill)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600 }}>
                {total} Treffer zeigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
