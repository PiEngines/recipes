import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import RecipeCard from '../components/RecipeCard'
import { getCategoryColor } from '../theme/categoryColors'

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Guten Morgen'
  if (h >= 12 && h < 18) return 'Guten Tag'
  if (h >= 18 && h < 23) return 'Guten Abend'
  return 'Hallo'
}

// ── ZettelCard (Wahl 2.0 · „Heute für dich", home.html) ───────────────────────
// Weiße Papier-Karte: Kategorie-Farbstreifen oben, Mono-Label (Kategorie-Farbe),
// Lora-Titel, Autor·Zeit. Kein Foto, kein Herz, kein Rating.

function formatTime(recipe) {
  const t = (recipe?.prep_time || 0) + (recipe?.cook_time || 0)
  if (!t) return null
  return t >= 60 ? `${Math.floor(t / 60)} Std.` : `${t} Min.`
}

function ZettelCard({ recipe, label, onClick, trackId, fullWidth }) {
  const category = recipe?.categories?.[0]?.name || null
  const catColor = getCategoryColor(category).base
  const author = recipe?.author?.name || recipe?.author?.username || null
  const time = formatTime(recipe)
  const meta = [author, time].filter(Boolean).join(' · ')
  return (
    <div
      onClick={onClick}
      data-track-id={trackId}
      style={{
        width: fullWidth ? '100%' : 'calc(100vw - 48px)',
        maxWidth: fullWidth ? 'none' : 320,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '2px 3px 0 rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08)',
        cursor: recipe ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ height: 3, background: catColor }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: catColor }}>{label}</p>
        <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 15, lineHeight: 1.12, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe?.title ?? '—'}
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{meta || '—'}</p>
      </div>
    </div>
  )
}

// ── KrautHero (Wahl 2.0 · §2.5 Kreidetafel, home.html) ────────────────────────
// Eigener Hero-Block: Kreidetafel-Look (var(--chalkboard), Linien-Textur, inset-
// Rahmen), „Kraut der Woche" + Pflanzenname (Lora italic 700, Creme).
// Ziel Pflanzen-Detail folgt mit F1 → bis dahin Klick auf /seasonal (kein toter Klick).

function KrautHero({ onClick }) {
  return (
    <div
      onClick={onClick}
      data-track-id="home-carousel-kraeuter-click"
      style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--chalkboard)', padding: '20px 18px 18px', cursor: 'pointer', userSelect: 'none' }}
    >
      {/* Kreidelinien-Textur */}
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,.015) 28px, rgba(255,255,255,.015) 29px)', pointerEvents: 'none' }} />
      {/* Inset-Rahmen */}
      <div style={{ position: 'absolute', inset: 3, borderRadius: 6, border: '1.5px solid rgba(255,255,255,.06)', pointerEvents: 'none' }} />
      {/* Kräuter-Glyph */}
      <svg style={{ position: 'absolute', right: 14, top: 14, opacity: 0.1, pointerEvents: 'none' }} width="56" height="56" viewBox="0 0 24 24" fill="var(--on-dark)" aria-hidden="true">
        <path d="M12 2C6 2 2 8 2 14c0 4 3 7 7 8 1-3 2-5 4-6-2 0-4-1-4-3s2-5 3-5 5 1 5 3-1 3-3 4c2 1 3 4 4 7 4-1 6-5 6-8 0-6-4-12-10-12z" />
      </svg>
      <div style={{ position: 'relative' }}>
        <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>✦ Kraut der Woche</p>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 32, lineHeight: 1, letterSpacing: '-.3px', color: 'var(--on-dark)' }}>Liebstöckel</h2>
        <p style={{ margin: '8px 0 14px', fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.45, color: 'rgba(240,232,208,.55)' }}>Intensives Aroma — für Suppen, Saucen und herzhafte Gerichte.</p>
        <span style={{ display: 'inline-block', border: '1.5px solid rgba(240,232,208,.35)', color: 'var(--on-dark)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', padding: '6px 14px', borderRadius: 3 }}>Mehr erfahren →</span>
      </div>
    </div>
  )
}

// ── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [carouselRecipes, setCarouselRecipes] = useState([null, null])
  const [neue, setNeue] = useState([])
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const feedState = useRef({ page: 1, loading: false, done: false })
  const sentinelRef = useRef(null)

  useEffect(() => {
    document.title = 'PiEngines Recipes'
    Promise.all([
      client.get('/api/recipes/random', { params: { count: 2 } }).catch(() => ({ data: [] })),
      client.get('/api/recipes', { params: { page_size: 1 } }).catch(() => ({ data: { items: [] } })),
      client.get('/api/recipes/random', { params: { count: 3 } }).catch(() => ({ data: [] })),
    ]).then(([carRes, newestRes, neueRes]) => {
      const [seasonal] = carRes.data
      const newestItem = newestRes.data.items?.[0] ?? null
      setCarouselRecipes([seasonal ?? null, newestItem])
      const neueItems = neueRes.data || []
      setNeue(neueItems)
    })
  }, [])

  const loadFeed = useCallback(() => {
    const st = feedState.current
    if (st.loading || st.done) return
    st.loading = true
    setFeedLoading(true)
    client.get('/api/recipes', { params: { page: st.page, page_size: 6 } })
      .then(({ data }) => {
        const items = data.items || []
        if (items.length < 6) st.done = true
        st.page += 1
        setFeed(prev => [...prev, ...items])
      })
      .catch(() => {})
      .finally(() => { st.loading = false; setFeedLoading(false) })
  }, [])

  useEffect(() => { loadFeed() }, [loadFeed])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadFeed() },
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadFeed])

  const [seasonal, newest] = carouselRecipes

  return (
    <div className="px-4 md:px-8" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 132, maxWidth: 960, margin: '0 auto', width: '100%' }}>

      {/* Greeting */}
      <div style={{ padding: '24px 0 28px' }}>
        <p style={{ fontSize: 11, color: 'var(--subtext)', fontFamily: 'var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 5px' }}>
          {getGreeting()}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 700, fontStyle: 'italic', color: 'var(--text)', letterSpacing: '-.5px', lineHeight: 1.15, margin: 0 }}>
          {user?.username ? `${user.username}!` : 'Willkommen!'}
        </h1>
      </div>

      {/* Kraut der Woche — Hero (§2.5 Kreidetafel) */}
      <div style={{ paddingBottom: 32 }}>
        <KrautHero onClick={() => navigate('/seasonal')} />
      </div>

      {/* Heute für dich */}
      <section style={{ paddingBottom: 32 }} aria-label="Heute für dich">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Heute für dich</span>
          <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        </div>
        <div className="flex md:hidden" style={{ gap: 12, overflowX: 'auto', flexWrap: 'nowrap', padding: '0 0 4px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <ZettelCard recipe={seasonal} label="Saisonal"
            onClick={() => seasonal && navigate(`/recipes/${seasonal.id}`)} trackId="home-carousel-seasonal-click" />
          <ZettelCard recipe={newest} label="Neu diese Woche"
            onClick={() => newest && navigate(`/recipes/${newest.id}`)} trackId="home-carousel-newest-click" />
        </div>
        <div className="hidden md:grid md:grid-cols-3" style={{ gap: 14 }}>
          <ZettelCard fullWidth recipe={seasonal} label="Saisonal"
            onClick={() => seasonal && navigate(`/recipes/${seasonal.id}`)} trackId="home-carousel-seasonal-click" />
          <ZettelCard fullWidth recipe={newest} label="Neu diese Woche"
            onClick={() => newest && navigate(`/recipes/${newest.id}`)} trackId="home-carousel-newest-click" />
        </div>
      </section>

      {/* Fratcher Teaser */}
      <div style={{ paddingBottom: 32 }}>
        <div
          onClick={() => navigate('/fratcher')}
          data-track-id="home-fratcher-teaser-click"
          style={{ background: 'linear-gradient(135deg, #3E5228 0%, #5E7840 100%)', borderRadius: 18, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        >
          <div className="md:hidden" style={{ padding: '20px 20px 18px' }}>
            <div style={{ position: 'absolute', right: -18, top: -24, width: 120, height: 120, borderRadius: 999, background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
            <i className="ti ti-fridge" style={{ fontSize: 26, color: 'rgba(255,255,255,.65)', display: 'block', marginBottom: 9, position: 'relative' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--on-accent)', margin: '0 0 6px', lineHeight: 1.35, position: 'relative' }}>
              Was kannst du heute kochen?
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', fontFamily: 'var(--font-body)', margin: '0 0 16px', lineHeight: 1.5, position: 'relative' }}>
              Entdecke Rezepte mit deinen Zutaten.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '9px 16px', position: 'relative' }}>
              <span style={{ fontSize: 13, color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>Kühlschrank prüfen</span>
              <i className="ti ti-arrow-right" style={{ fontSize: 14, color: 'var(--on-accent)' }} />
            </div>
          </div>
          <div className="hidden md:flex" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '22px 28px' }}>
            <div style={{ position: 'absolute', right: -18, top: -30, width: 200, height: 200, borderRadius: 999, background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
              <i className="ti ti-fridge" style={{ fontSize: 34, color: 'rgba(255,255,255,.65)', flexShrink: 0 }} />
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: 'var(--on-accent)', margin: '0 0 5px', lineHeight: 1.3 }}>
                  Was kannst du heute kochen?
                </h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.72)', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.5 }}>
                  Entdecke Rezepte mit deinen Zutaten.
                </p>
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '12px 22px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
              <span style={{ fontSize: 14, color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>Kühlschrank prüfen</span>
              <i className="ti ti-arrow-right" style={{ fontSize: 15, color: 'var(--on-accent)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Kategorien-Einstieg */}
      <div style={{ paddingBottom: 32 }}>
        <div
          onClick={() => navigate('/categories')}
          data-track-id="home-categories-teaser-click"
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}
        >
          <i className="ti ti-category" style={{ fontSize: 22, color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Nach Kategorie stöbern</div>
            <div style={{ fontSize: 13, color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Alle Kategorien auf einen Blick</div>
          </div>
          <i className="ti ti-arrow-right" style={{ fontSize: 16, color: 'var(--subtext)', flexShrink: 0 }} />
        </div>
      </div>

      {/* Neue Rezepte */}
      <section style={{ paddingBottom: 28 }} aria-label="Neue Rezepte">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            <span onClick={() => navigate('/recipes?sort=newest')} style={{ cursor: 'pointer', color: 'var(--text)', textDecoration: 'none' }}>
              Neue Rezepte
            </span>
          </h2>
          <button onClick={() => navigate('/recipes?sort=newest')} data-track-id="home-neue-mehr-click"
            style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            Mehr →
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
          {neue.map(r => (
            <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipes/${r.id}`)} />
          ))}
        </div>
      </section>

      {/* Entdecken Feed */}
      <section id="home-feed" aria-label="Entdecken" style={{ paddingBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>
          Entdecken
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
          {feed.map(r => (
            <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipes/${r.id}`)} />
          ))}
        </div>
        {feedLoading && (
          <div style={{ textAlign: 'center', padding: '20px 0 8px', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            Lädt …
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </section>
    </div>
  )
}
