import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import PostKachel from '../components/PostKachel'
import PostOverlay from '../components/PostOverlay'
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

function ZettelCard({ recipe, label, color, onClick, trackId }) {
  const category = recipe?.categories?.[0]?.name || null
  const catColor = color || getCategoryColor(category).base
  const author = recipe?.author?.name || recipe?.author?.username || null
  const time = formatTime(recipe)
  const meta = [author, time].filter(Boolean).join(' · ')
  return (
    <div
      onClick={onClick}
      data-track-id={trackId}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        background: 'var(--surface)',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '2px 3px 0 rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08)',
        cursor: recipe ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ height: 3, background: catColor }} />
      <div style={{ padding: '9px 11px 11px' }}>
        <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: catColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 14, lineHeight: 1.1, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe?.title ?? '—'}
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta || '—'}</p>
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

// ── KrautKachel (F3b-3) ──────────────────────────────────────────────────────
// Das Kraut des Monats als Kachel im Entdecken-Feed — gleiche Proportion und
// Rundung wie RecipeCard, aber in der Kräuter-Farbwelt (grüner Akzent), damit
// es sich im Raster einreiht und trotzdem als anderer Inhaltstyp lesbar ist.

function KrautKachel({ spotlight, onClick }) {
  if (!spotlight) return null

  return (
    <div
      onClick={onClick}
      data-track-id="home-feed-kraut-click"
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        aspectRatio: '4 / 3', overflow: 'hidden', cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        borderLeft: '3px solid var(--green)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: '12px 13px',
      }}
    >
      {/* Kräuter-Glyph — dezent, wie im KrautHero */}
      <svg style={{ position: 'absolute', right: 8, top: 8, opacity: 0.08, pointerEvents: 'none' }}
        width="52" height="52" viewBox="0 0 24 24" fill="var(--green)" aria-hidden="true">
        <path d="M12 2C6 2 2 8 2 14c0 4 3 7 7 8 1-3 2-5 4-6-2 0-4-1-4-3s2-5 3-5 5 1 5 3-1 3-3 4c2 1 3 4 4 7 4-1 6-5 6-8 0-6-4-12-10-12z" />
      </svg>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)' }}>
          ✦ Kraut des Monats
        </p>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 19, lineHeight: 1.1, letterSpacing: '-.2px', color: 'var(--text)' }}>
          {spotlight.deutscher_name}
        </h3>
        {spotlight.teaser && (
          <p style={{ margin: '5px 0 0', fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.45, color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {spotlight.teaser}
          </p>
        )}
      </div>
    </div>
  )
}

// Ladeplatzhalter im Raster — hält das Layout ruhig, statt es springen zu lassen.
function FeedSkelett() {
  return (
    <div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--radius-card)', background: 'var(--bg-alt)', border: '1px solid var(--hairline)' }} />
  )
}

// Ein Feed-Item ist ein getaggter Umschlag — `type` sagt, welches Feld trägt.
function feedKey(item, index) {
  if (item.type === 'recipe') return `recipe-${item.recipe?.id ?? index}`
  if (item.type === 'external_post') return `post-${item.post?.id ?? index}`
  return `spotlight-${item.spotlight?.slug ?? index}`
}

// ── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [carouselRecipes, setCarouselRecipes] = useState([null, null])
  const [beliebt, setBeliebt] = useState(null)
  const [neue, setNeue] = useState([])
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState(false)
  const [offenerPost, setOffenerPost] = useState(null)
  // Cursor statt Seitenzahl: der Feed ist ein Live-Stream, Offset-Paginierung
  // würde beim Nachladen driften (Dubletten bzw. übersprungene Items).
  const feedState = useRef({ cursor: null, loading: false, done: false })
  const sentinelRef = useRef(null)

  useEffect(() => {
    document.title = 'PiEngines Recipes'
    Promise.all([
      client.get('/api/recipes/random', { params: { count: 2 } }).catch(() => ({ data: [] })),
      client.get('/api/recipes', { params: { page_size: 1 } }).catch(() => ({ data: { items: [] } })),
      client.get('/api/recipes/random', { params: { count: 3 } }).catch(() => ({ data: [] })),
      client.get('/api/recipes', { params: { page_size: 1, sort: 'rating' } }).catch(() => ({ data: { items: [] } })),
    ]).then(([carRes, newestRes, neueRes, beliebtRes]) => {
      const [seasonal] = carRes.data
      const newestItem = newestRes.data.items?.[0] ?? null
      setCarouselRecipes([seasonal ?? null, newestItem])
      setNeue(neueRes.data || [])
      setBeliebt(beliebtRes.data.items?.[0] ?? null)
    })
  }, [])

  const loadFeed = useCallback(() => {
    const st = feedState.current
    if (st.loading || st.done) return
    st.loading = true
    setFeedLoading(true)
    setFeedError(false)
    const params = { limit: 12 }
    if (st.cursor) params.before = st.cursor
    client.get('/api/feed', { params })
      .then(({ data }) => {
        st.cursor = data.next_cursor ?? null
        if (!st.cursor) st.done = true
        setFeed(prev => [...prev, ...(data.items || [])])
      })
      .catch(() => {
        // Pausieren statt weiterprobieren: der Sentinel steht am Seitenende und
        // würde sonst sofort den nächsten Fehlversuch auslösen. Der Retry-Button
        // gibt das Nachladen wieder frei.
        st.done = true
        setFeedError(true)
      })
      .finally(() => { st.loading = false; setFeedLoading(false) })
  }, [])

  const retryFeed = useCallback(() => {
    feedState.current.done = false
    setFeedError(false)
    loadFeed()
  }, [loadFeed])

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <ZettelCard recipe={seasonal} label="Saisonal"
            onClick={() => seasonal && navigate(`/recipes/${seasonal.id}`)} trackId="home-carousel-seasonal-click" />
          <ZettelCard recipe={newest} label="Neu"
            onClick={() => newest && navigate(`/recipes/${newest.id}`)} trackId="home-carousel-newest-click" />
          <ZettelCard recipe={beliebt} label="Beliebt" color="var(--gold)"
            onClick={() => beliebt && navigate(`/recipes/${beliebt.id}`)} trackId="home-carousel-beliebt-click" />
        </div>
      </section>

      {/* Kühlschrank-Banner (Fratcher) — §01, home.html */}
      <div style={{ paddingBottom: 32 }}>
        <div
          onClick={() => navigate('/fratcher')}
          data-track-id="home-fratcher-teaser-click"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--bg-alt)', borderLeft: '3px solid var(--green)', borderRadius: 4, padding: '12px 14px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <i className="ti ti-fridge" style={{ fontSize: 20, color: 'var(--green)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Was kannst du heute kochen?</p>
              <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>Schau, was im Kühlschrank ist.</p>
            </div>
          </div>
          <span style={{ flexShrink: 0, background: 'var(--green)', color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, padding: '7px 12px', borderRadius: 3, whiteSpace: 'nowrap' }}>Prüfen →</span>
        </div>
      </div>

      {/* Kategorien-Einstieg */}
      <div style={{ paddingBottom: 32 }}>
        <div
          onClick={() => navigate('/categories')}
          data-track-id="home-categories-teaser-click"
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-card)', padding: '15px 16px', cursor: 'pointer', boxShadow: 'var(--shadow-card)' }}
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
          {feed.map((item, index) => {
            const key = feedKey(item, index)

            if (item.type === 'recipe' && item.recipe) {
              return (
                <RecipeCard key={key} recipe={item.recipe}
                  onClick={() => navigate(`/recipes/${item.recipe.id}`)} />
              )
            }

            if (item.type === 'spotlight' && item.spotlight) {
              return (
                <KrautKachel key={key} spotlight={item.spotlight}
                  onClick={() => navigate(`/pflanzen/${item.spotlight.slug}`)} />
              )
            }

            if (item.type === 'external_post' && item.post) {
              // Kompakte Kachel wie Rezept und Kraut — der abspielbare Embed
              // öffnet erst im Overlay. Als volle Zeile erschlug er das Raster,
              // und jeder Beitrag im Scroll hätte einen Fremd-Player geladen.
              return (
                <PostKachel key={key} post={item.post}
                  onClick={() => setOffenerPost(item.post)} />
              )
            }

            return null
          })}
          {feedLoading && feed.length === 0 && (
            <>
              <FeedSkelett /><FeedSkelett /><FeedSkelett /><FeedSkelett />
            </>
          )}
        </div>

        {feedLoading && feed.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0 8px', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            Lädt …
          </div>
        )}

        {feedError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '18px 0 8px' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--subtext)' }}>
              Konnte nicht geladen werden.
            </span>
            <button onClick={retryFeed} data-track-id="home-feed-retry-click"
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              Erneut versuchen
            </button>
          </div>
        )}

        {!feedLoading && !feedError && feed.length === 0 && (
          <p style={{ textAlign: 'center', padding: '18px 0 8px', margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
            Hier ist noch nichts — Rezepte und Beiträge erscheinen, sobald sie angelegt sind.
          </p>
        )}

        <div ref={sentinelRef} style={{ height: 1 }} />

        {offenerPost && (
          <PostOverlay post={offenerPost} onClose={() => setOffenerPost(null)} />
        )}
      </section>
    </div>
  )
}
