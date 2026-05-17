import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'

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

function diffColor(d) {
  if (d <= 3) return '#6B7C4E'
  if (d <= 6) return '#C8A020'
  return '#C8602A'
}

// ── Icons ────────────────────────────────────────────────────────────────────

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

// ── Recipe card ───────────────────────────────────────────────────────────────
// Items 6, 7, 8: gleiche Höhe + warme Farben + kein doppelter Titel

function RecipeCard({ recipe, primaryImage }) {
  const gradient = CARD_GRADIENTS[recipe.id % CARD_GRADIENTS.length]
  const color = recipe.difficulty ? diffColor(recipe.difficulty) : null
  const isDraft = recipe.status === 'draft'

  const draftBadge = isDraft && (
    <span style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', padding: '0.2rem 0.55rem', background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', zIndex: 2 }}>
      Entwurf
    </span>
  )

  const titleSpan = (
    <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,0.45)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {recipe.title}
    </span>
  )

  // ── Magazine Card (Foto vorhanden) ──────────────────────────────────────────
  if (primaryImage) {
    return (
      <Link to={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', display: 'block', color: 'inherit', height: '100%' }}>
        <div className="recipe-card" style={{ position: 'relative', overflow: 'hidden', height: '100%', minHeight: '280px' }}>
          {/* Hintergrundbild */}
          <div
            className="card-image-bg"
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${primaryImage.thumbnail_url || primaryImage.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transition: 'transform 0.3s ease',
            }}
          />
          {/* Overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)' }} />
          {/* Entwurf-Badge */}
          {draftBadge}
          {/* Titel + Pills unten */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem' }}>
            {titleSpan}
            {(recipe.prep_time || recipe.cook_time) && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                {recipe.prep_time && (
                  <span style={{ padding: '0.15rem 0.45rem', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 500, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                    ⏱ {recipe.prep_time} min
                  </span>
                )}
                {recipe.cook_time && (
                  <span style={{ padding: '0.15rem 0.45rem', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 500, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                    🍳 {recipe.cook_time} min
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // ── Gradient Card (kein Foto) — unverändert ──────────────────────────────────
  return (
    <Link to={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', display: 'block', color: 'inherit', height: '100%' }}>
      <div className="recipe-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: gradient, height: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.875rem 1rem', position: 'relative' }}>
          {draftBadge}
          {titleSpan}
        </div>
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.625rem' }}>
          <div style={{ flex: 1 }}>
            {recipe.description ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {recipe.description}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--border-input)' }}>&nbsp;</p>
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
            {recipe.difficulty && (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i < recipe.difficulty ? color : 'var(--border-input)', display: 'inline-block', flexShrink: 0 }} />
                ))}
                <span style={{ marginLeft: '0.375rem', fontSize: '0.7rem', color: 'var(--subtext)' }}>{recipe.difficulty}/10</span>
              </div>
            )}
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

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ background: 'none', border: `1.5px solid ${hov ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hov ? 'var(--accent)' : 'var(--subtext)', transition: 'var(--transition)', flexShrink: 0 }}>
      {children}
    </button>
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
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const [recipes, setRecipes]         = useState([])
  const [primaryImages, setPrimaryImages] = useState({}) // { recipeId: mediaObj | null }
  const [loading, setLoading]         = useState(true)
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [showMenu, setShowMenu]       = useState(false)

  const menuRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    const handle = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showMenu])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    const params = { page, page_size: PAGE_SIZE }
    if (search) params.search = search
    client.get('/api/recipes', { params })
      .then(res => {
        const items = res.data.items
        setRecipes(items)
        setTotal(res.data.total)
        // Primärbilder parallel laden
        Promise.all(
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
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--card)', boxShadow: 'var(--shadow)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'background-color 0.3s ease' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, margin: 0, color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          🍽️ PiEngines
        </h1>

        <SearchInput value={searchInput} onChange={setSearchInput} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {isAdmin && (
            <button
              onClick={() => navigate('/recipes/new')}
              style={{ padding: '0.45rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, whiteSpace: 'nowrap', transition: 'var(--transition)', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
            >
              + Neues Rezept
            </button>
          )}
          <IconBtn onClick={toggle} title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconBtn>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(m => !m)} title={user?.name} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {initials}
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '44px', background: 'var(--card)', boxShadow: 'var(--shadow-hover)', borderRadius: '10px', padding: '0.375rem', minWidth: '170px', zIndex: 200 }}>
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--subtext)', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>{user?.name}</div>
                <UserMenuItem onClick={() => { setShowMenu(false); logout() }}>Abmelden</UserMenuItem>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {!loading && total > 0 && (
          <p style={{ color: 'var(--subtext)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
            {total} Rezept{total !== 1 ? 'e' : ''}{search ? ` für „${search}"` : ''}
          </p>
        )}

        {loading ? (
          /* Item 6: align-items: stretch (CSS-Grid-Default, aber explizit) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            {recipes.map(r => <RecipeCard key={r.id} recipe={r} primaryImage={primaryImages[r.id] ?? null} />)}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
            <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Zurück</PageBtn>
            <span style={{ color: 'var(--subtext)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Seite {page} / {totalPages}</span>
            <PageBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Weiter →</PageBtn>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SearchInput({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <input type="search" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Rezepte suchen …" style={{ flex: 1, maxWidth: '400px', padding: '0.5rem 1rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'var(--transition)', boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none' }} />
  )
}

function UserMenuItem({ onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: hov ? 'rgba(200,96,42,0.1)' : 'none', border: 'none', borderRadius: '6px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s ease' }}>
      {children}
    </button>
  )
}
