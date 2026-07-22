import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { isKochOrAbove } from '../utils/roles'
import RecipeCard from '../components/RecipeCard'
import { getCategoryColor } from '../theme/categoryColors'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

// Server-Cap für `page_size` (recipes/router.py: `le=100`). Beim Wiederherstellen
// wird in Blöcken geholt, die dieses Maß und zugleich ein Vielfaches von
// PAGE_SIZE einhalten — sonst passen die Offsets der Folgeseiten nicht mehr.
const MAX_PAGE_SIZE = 100
const RESTORE_BLOCK = Math.floor(MAX_PAGE_SIZE / PAGE_SIZE) * PAGE_SIZE

// Scroll-Position + Ladestand für die Rückkehr aus dem Detail.
const RESTORE_KEY = 'recipes_restore'

// Sort-Dropdown → Server-`sort` (Client-Sort entfällt; Reihenfolge kommt vom
// Server). Datum und Kochzeit gibt es jeweils in beide Richtungen; die Labels
// benennen die Richtung, statt sie zu verschweigen.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'oldest', label: 'Älteste zuerst' },
  { value: 'rating', label: 'Beste Bewertung' },
  { value: 'time_asc', label: 'Kochzeit ↑ (kurz)' },
  { value: 'time_desc', label: 'Kochzeit ↓ (lang)' },
]

// „Relevanz" heißt: keinen `sort` mitschicken und den Server entscheiden
// lassen. Das ergibt nur bei aktiver Suche Sinn — beim reinen Blättern stand
// darüber „Relevanz", sortiert wurde aber ohnehin nach Datum (BUG-08).
const RELEVANZ = { value: 'default', label: 'Relevanz' }

const SERVER_SORTS = new Set(['newest', 'oldest', 'rating', 'time_asc', 'time_desc'])

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

function EmptyState({ search, hasActiveFilters, diagnosis, onClearFilters }) {
  const hasDiagnosis = hasActiveFilters && diagnosis.length > 0
  const topBlocker = diagnosis[0]?.label
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <i className="ti ti-search-off" style={{ fontSize: 26, color: 'var(--text-muted)' }} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)', margin: '0 0 6px' }}>
        {search || hasActiveFilters ? 'Keine Treffer' : 'Noch keine Rezepte vorhanden'}
      </h3>
      {hasDiagnosis ? (
        <>
          <p style={{ margin: '0 0 20px', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 300 }}>
            Die Kombination deiner Filter passt auf kein Rezept.{topBlocker ? <> Der Filter <strong>»{topBlocker}«</strong> blockiert die meisten Ergebnisse:</> : ''}
          </p>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.08), 0 4px 0 0 var(--wood-shadow)', padding: '14px 16px', marginBottom: 14, textAlign: 'left' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {diagnosis.map((d, i) => (
                <button key={d.label} onClick={d.remove} data-track-id="recipes-diagnosis-remove"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 3, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', background: i === 0 ? 'var(--green)' : 'var(--bg-alt)', color: i === 0 ? 'var(--on-dark)' : 'var(--text)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>ohne <strong>{d.label}</strong> zeigen</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>+{d.plus} Treffer →</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClearFilters} data-track-id="recipes-diagnosis-reset" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.04em', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Alle Filter zurücksetzen
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            {search || hasActiveFilters ? 'Keine Rezepte für diese Kombination.' : 'Hier erscheinen demnächst leckere Rezepte.'}
          </p>
          {hasActiveFilters && (
            <button onClick={onClearFilters} style={{ marginTop: 14, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Alle Filter zurücksetzen
            </button>
          )}
        </>
      )}
    </div>
  )
}

function EmptyFavoritesState() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--subtext)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤍</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>Noch keine Favoriten</h3>
      <p style={{ margin: 0, fontSize: '0.925rem' }}>Markiere Rezepte mit dem Herz-Symbol, um sie hier wiederzufinden.</p>
    </div>
  )
}

function DeletedFavoriteCard({ recipe }) {
  const { removeFavorite } = useFavorites()
  return (
    <div className="recipe-card" style={{ height: '100%', minHeight: '260px', display: 'flex', flexDirection: 'column', opacity: 0.55, filter: 'grayscale(1)' }}>
      <div style={{ background: 'linear-gradient(135deg, #8a8a86 0%, #b6b6b2 100%)', aspectRatio: '4 / 3', flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '0.875rem 1rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {recipe.title}
        </span>
      </div>
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)', fontStyle: 'italic' }}>Rezept nicht mehr verfügbar</p>
        <button onClick={() => removeFavorite(recipe.id)}
          style={{ alignSelf: 'flex-start', padding: '0.4rem 0.85rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--subtext)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)', transition: 'var(--transition)' }}>
          Aus Favoriten entfernen
        </button>
      </div>
    </div>
  )
}

function AuthorFilterChip({ author, onClear }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.5rem 0.5rem 1rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
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
        cursor: disabled ? 'default' : 'pointer', fontSize: 10, fontWeight: 400, fontFamily: 'var(--font-mono)',
        borderRadius: 2, padding: '5px 12px', whiteSpace: 'nowrap',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-input)'}`,
        background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        opacity: disabled ? 0.4 : 1,
        transition: 'var(--transition)',
      }}
    >
      {children}{count !== undefined && <span style={{ opacity: 0.6, marginLeft: 5 }}>({count})</span>}
    </button>
  )
}

function FilterPanel({ groups }) {
  return (
    <nav aria-label="Filter" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {groups.map(g => (
        g.opts.length === 0 ? null : (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
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
  const showFavorites = searchParams.get('favorites') === '1' && isKochOrAbove(user)
  const authorFilter = searchParams.get('author') || ''
  const authorIdFilter = searchParams.get('author_id') || null
  const typeFilters = new Set((searchParams.get('type') || '').split(',').filter(Boolean))
  const dietFilters = new Set((searchParams.get('diet') || '').split(',').filter(Boolean))
  const courseFilters = new Set((searchParams.get('course') || '').split(',').filter(Boolean))
  const difficultyFilters = new Set((searchParams.get('difficulty') || '').split(',').filter(Boolean))
  const categoryFilters = new Set((searchParams.get('category') || '').split(',').filter(Boolean))
  const maxTimeFilter = parseInt(searchParams.get('max_time') || '0', 10)
  // Ohne Suche ist „Neueste zuerst" der Default — vorher stand hier
  // „Relevanz", ohne dass es eine Relevanz zu sortieren gab.
  const sort = searchParams.get('sort') || (search ? 'default' : 'newest')
  const sortOptions = search ? [RELEVANZ, ...SORT_OPTIONS] : SORT_OPTIONS

  // Keys for the fetch effect dependency array (Sets are new refs every render).
  const typeKey = searchParams.get('type') || ''
  const dietKey = searchParams.get('diet') || ''
  const courseKey = searchParams.get('course') || ''
  const difficultyKey = searchParams.get('difficulty') || ''
  const categoryKey = searchParams.get('category') || ''

  const effectiveAuthor = authorFilter || (scopeAuthor && search ? search : '')

  // Signatur der aktuellen Abfrage — dieselben Werte, die unten den Neuaufbau
  // der Liste auslösen. Der Scroll-Restore gilt nur, solange sie passt.
  const queryKey = JSON.stringify([
    search, scopeDesc, scopeIng, scopeAuthor, showFavorites, authorFilter,
    authorIdFilter, effectiveAuthor, typeKey, dietKey, courseKey,
    difficultyKey, categoryKey, maxTimeFilter, sort,
  ])

  // Baut die /api/recipes-Query aus expliziten Filter-Sets — eine Quelle für Haupt-Fetch + Diagnose (⑤).
  const buildRecipeParams = (t, di, co, df, ca, mt, pg = 1) => {
    const scopeParts = ['title']
    if (scopeDesc) scopeParts.push('description', 'steps')
    if (scopeIng) scopeParts.push('ingredients')
    const p = { page: pg, page_size: PAGE_SIZE, search_scope: scopeParts.join(',') }
    if (authorIdFilter) p.author_id = authorIdFilter
    else if (effectiveAuthor) p.author = effectiveAuthor
    else if (search) p.search = search
    if (t.size === 1) p.type = [...t][0]
    else if (t.size > 1) p.type = [...t].sort().join(',')
    if (di.size) p.diet = [...di]
    if (co.size) p.course = [...co]
    if (df.size) p.difficulty = [...df]
    if (ca.size) p.category = [...ca]
    if (mt) p.max_time = mt
    if (SERVER_SORTS.has(sort)) p.sort = sort
    return p
  }

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // Ladefortschritt der Liste — bewusst im Ref: der Observer feuert öfter, als
  // gerendert wird, und muss sofort sehen, dass schon geladen wird.
  const listState = useRef({ page: 0, geladen: 0, done: false, loading: false })
  const ladenRef = useRef({})
  const sentinelRef = useRef(null)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState({})           // {diet:{id:count}, course:{value:count}, difficulty:{level:count}, category:{id:count}}
  const [dietOpts, setDietOpts] = useState([])       // [{ id, name }]
  const [courseOpts, setCourseOpts] = useState([])   // [string]
  const [categoryOpts, setCategoryOpts] = useState([]) // [{ id, name, slug, recipe_count }]
  const [sheetOpen, setSheetOpen] = useState(false)
  // Sheet-Animation: `sheetIn` schaltet einen Frame nach dem Mount auf 0 und
  // löst damit den Slide-in aus. `dragY` ist der Versatz während des Ziehens
  // am Griff — beim Loslassen entweder zurück auf 0 oder ganz hinaus.
  const [sheetIn, setSheetIn] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef(0)
  const panelRef = useRef(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [diagnosis, setDiagnosis] = useState([])
  const [reloadNonce, setReloadNonce] = useState(0)

  // Option-Listen (einmalig)
  useEffect(() => {
    client.get('/api/diet-labels').then(({ data }) => setDietOpts(data)).catch(() => {})
    client.get('/api/courses').then(({ data }) => setCourseOpts(data)).catch(() => {})
    client.get('/api/categories').then(({ data }) => setCategoryOpts(data)).catch(() => {})
  }, [])

  // ── Laden: Seite 1 ersetzt, jede weitere hängt an (Infinite Scroll) ────────
  //
  // Muster wie im Home-Feed: ein Sentinel am Listenende zieht die nächste
  // Seite nach. Der Fortschritt steht im Ref, nicht im State — er darf kein
  // Rendern auslösen und muss innerhalb desselben Ticks stimmen, sonst feuert
  // der Observer mehrfach dieselbe Seite.
  const ladeSeite = (pg) => {
    const st = listState.current
    if (st.loading || (pg > 1 && st.done)) return
    st.loading = true
    if (pg === 1) setLoading(true)
    else setLoadingMore(true)
    setError(false)

    const fertig = () => {
      st.loading = false
      // Die Ladeanzeige gehört inzwischen ggf. einer neueren Abfrage.
      if (listState.current !== st) return
      setLoading(false)
      setLoadingMore(false)
    }

    // Favoriten liegen komplett im Client — hier wird nur weiter aufgedeckt.
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
      const bis = pg * PAGE_SIZE
      const sichtbar = list.slice(0, bis)
      st.page = pg
      st.geladen = sichtbar.length
      st.done = bis >= list.length
      setRecipes(sichtbar)
      setTotal(list.length)
      setFacets({}) // Favoriten sind client-seitig → keine Server-Facetten
      fertig()
      return
    }

    const params = buildRecipeParams(typeFilters, dietFilters, courseFilters, difficultyFilters, categoryFilters, maxTimeFilter, pg)

    client.get('/api/recipes', { params, paramsSerializer: { indexes: null } })
      .then(res => {
        // Query hat sich während des Requests geändert (der Reset-Effekt legt
        // dafür ein neues `listState`-Objekt an) → Antwort verwerfen.
        if (listState.current !== st) return
        const items = res.data.items || []
        st.page = pg
        st.geladen = (pg === 1 ? 0 : st.geladen) + items.length
        st.done = items.length === 0 || st.geladen >= (res.data.total ?? 0)
        setRecipes(prev => (pg === 1 ? items : [...prev, ...items]))
        setTotal(res.data.total)
        setFacets(res.data.facets || {})
      })
      .catch(() => {
        // Pausieren statt weiterprobieren: der Sentinel steht am Listenende und
        // würde sonst sofort den nächsten Fehlversuch auslösen. Der
        // Retry-Button gibt das Nachladen wieder frei.
        st.done = true
        setError(true)
      })
      .finally(fertig)
  }

  // ── Rückkehr aus dem Detail ────────────────────────────────────────────────

  // Erst nach dem Paint scrollen: vorher stehen die nachgeladenen Karten noch
  // nicht im DOM und `scrollTo` liefe ins Leere. `minHeight` überbrückt den
  // Moment, bis das Layout die gespeicherte Höhe wirklich hergibt.
  const scrolleZurueck = (restore) => {
    requestAnimationFrame(() => {
      document.body.style.minHeight = restore.h + 'px'
      window.scrollTo({ top: restore.y, behavior: 'instant' })
      requestAnimationFrame(() => { document.body.style.minHeight = '' })
    })
  }

  // Einmalig auslesen. Ein Eintrag aus einer anderen Query (Filter/Sortierung
  // zwischenzeitlich geändert) wird verworfen, nicht angewendet — sonst
  // stellte er die falsche Liste wieder her.
  const leseRestore = () => {
    const roh = sessionStorage.getItem(RESTORE_KEY)
    if (!roh) return null
    sessionStorage.removeItem(RESTORE_KEY)
    try {
      const daten = JSON.parse(roh)
      return daten?.key === queryKey && daten.geladen > 0 ? daten : null
    } catch {
      return null
    }
  }

  // Alle zuvor geladenen Rezepte zurückholen, bevor gescrollt wird — genau
  // das fehlte: nach dem Umstieg auf Infinite Scroll lag nur Seite 1 vor und
  // die gespeicherte Position war gar nicht erreichbar.
  const ladeWiederher = async (restore) => {
    const st = listState.current
    if (st.loading) return
    st.loading = true
    setLoading(true)
    setError(false)

    // Favoriten liegen im Client — dort genügt es, weiter aufzudecken.
    if (showFavorites) {
      st.loading = false
      ladeSeite(Math.max(1, Math.ceil(restore.geladen / PAGE_SIZE)))
      scrolleZurueck(restore)
      return
    }

    // Blockgröße für alle Requests gleich halten, sonst stimmen die Offsets
    // der Folgeseiten nicht.
    const block = Math.min(RESTORE_BLOCK, Math.ceil(restore.geladen / PAGE_SIZE) * PAGE_SIZE)
    const gesammelt = []
    let summe = 0
    let facetten = {}

    try {
      for (let pg = 1; gesammelt.length < restore.geladen; pg++) {
        const params = buildRecipeParams(typeFilters, dietFilters, courseFilters, difficultyFilters, categoryFilters, maxTimeFilter, pg)
        params.page_size = block
        const res = await client.get('/api/recipes', { params, paramsSerializer: { indexes: null } })
        const items = res.data.items || []
        summe = res.data.total ?? 0
        facetten = res.data.facets || {}
        gesammelt.push(...items)
        if (items.length < block) break
      }

      // Der Restore läuft über mehrere Requests — in der Zeit kann ein
      // Filterwechsel dazwischenkommen. Dann gehört das Ergebnis nicht mehr
      // zur aktuellen Liste.
      if (listState.current !== st) return

      st.page = Math.ceil(gesammelt.length / PAGE_SIZE)
      st.geladen = gesammelt.length
      st.done = gesammelt.length >= summe
      setRecipes(gesammelt)
      setTotal(summe)
      setFacets(facetten)
      scrolleZurueck(restore)
    } catch {
      if (listState.current !== st) return
      st.done = true
      setError(true)
    } finally {
      st.loading = false
      // Die Ladeanzeige gehört inzwischen ggf. einer neueren Abfrage.
      if (listState.current === st) setLoading(false)
    }
  }

  // Nach jeder Render-Runde die frischen Closures hinterlegen — der Observer
  // unten wird nur einmal aufgesetzt und greift trotzdem immer auf die
  // aktuellen Filter zu. Muss vor den Effekten darunter stehen, damit die beim
  // ersten Durchlauf schon einen Loader vorfinden.
  useEffect(() => { ladenRef.current = { ladeSeite, ladeWiederher, leseRestore } })

  // Suche, Filter oder Sortierung geändert → Zähler zurück und neu ab Seite 1.
  // Die alte Liste bleibt bis zur Antwort im State, ist aber nicht zu sehen:
  // `ladeSeite(1)` schaltet auf `loading`, also auf die Skeletons.
  useEffect(() => {
    listState.current = { page: 0, geladen: 0, done: false, loading: false }
    const restore = ladenRef.current.leseRestore()
    if (restore) ladenRef.current.ladeWiederher(restore)
    else ladenRef.current.ladeSeite(1)
  }, [search, scopeDesc, scopeIng, scopeAuthor, showFavorites, authorFilter, authorIdFilter, effectiveAuthor, typeKey, dietKey, courseKey, difficultyKey, categoryKey, maxTimeFilter, sort, reloadNonce])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return undefined
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) ladenRef.current.ladeSeite(listState.current.page + 1) },
      { rootMargin: '300px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Ohne Aufrufer, seit der Favoriten-Filter aus der Toolbar raus ist (BUG-07).
  // Bleibt bewusst stehen: `?favorites=1` funktioniert weiter (bestehende Links,
  // Lesezeichen), nur der Einstieg aus der UI fehlt. Favoriten laufen über das
  // Mehr-Panel und `/favorites`.
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
      label: 'Kategorie',
      opts: categoryOpts.map(c => ({ key: 'cat-' + c.id, label: c.name, active: categoryFilters.has(String(c.id)), count: facetCount('category', c.id), toggle: () => toggleMulti('category', String(c.id)) })),
    },
    {
      label: 'Zeitaufwand',
      opts: ZEIT_OPTS.map(o => ({ key: 'time-' + o.value, label: o.label, active: maxTimeFilter === o.value, toggle: () => toggleTimeFilter(o.value) })),
    },
  ]

  const activeFilterCount = typeFilters.size + dietFilters.size + courseFilters.size + difficultyFilters.size + categoryFilters.size + (maxTimeFilter ? 1 : 0)

  // Aktive Filter → schwebende Pills (§2.10). dot = Kategorie-Farbe für Kategorie-Filter, sonst neutral.
  const chips = [
    ...[...typeFilters].map(t => ({ key: 'type-' + t, label: t === 'kochen' ? 'Kochen' : 'Backen', dot: null, remove: () => toggleTypeFilter(t) })),
    ...[...dietFilters].map(id => ({ key: 'diet-' + id, label: dietOpts.find(d => String(d.id) === id)?.name || 'Ernährung', dot: null, remove: () => toggleMulti('diet', id) })),
    ...[...courseFilters].map(c => ({ key: 'course-' + c, label: c, dot: null, remove: () => toggleMulti('course', c) })),
    ...[...difficultyFilters].map(v => ({ key: 'diff-' + v, label: DIFFICULTY_OPTS.find(o => String(o.value) === v)?.label || `Stufe ${v}`, dot: null, remove: () => toggleMulti('difficulty', v) })),
    ...(maxTimeFilter ? [{ key: 'time', label: `Bis ${maxTimeFilter} Min.`, dot: null, remove: () => toggleTimeFilter(maxTimeFilter) }] : []),
    ...[...categoryFilters].map(id => {
      const name = categoryOpts.find(c => String(c.id) === id)?.name
      return { key: 'cat-' + id, label: name || 'Kategorie', dot: name ? getCategoryColor(name).base : null, remove: () => toggleMulti('category', id) }
    }),
  ]

  // Filter-Diagnose (⑤): je aktivem Filter „ohne X" — total via Zusatz-Request → +n.
  const setMinus = (s, v) => new Set([...s].filter(x => x !== v))
  const diagFilters = [
    ...[...typeFilters].map(t => ({ key: 'type-' + t, label: t === 'kochen' ? 'Kochen' : 'Backen', remove: () => toggleTypeFilter(t), params: buildRecipeParams(setMinus(typeFilters, t), dietFilters, courseFilters, difficultyFilters, categoryFilters, maxTimeFilter) })),
    ...[...dietFilters].map(id => ({ key: 'diet-' + id, label: dietOpts.find(d => String(d.id) === id)?.name || 'Ernährung', remove: () => toggleMulti('diet', id), params: buildRecipeParams(typeFilters, setMinus(dietFilters, id), courseFilters, difficultyFilters, categoryFilters, maxTimeFilter) })),
    ...[...courseFilters].map(c => ({ key: 'course-' + c, label: c, remove: () => toggleMulti('course', c), params: buildRecipeParams(typeFilters, dietFilters, setMinus(courseFilters, c), difficultyFilters, categoryFilters, maxTimeFilter) })),
    ...[...difficultyFilters].map(v => ({ key: 'diff-' + v, label: DIFFICULTY_OPTS.find(o => String(o.value) === v)?.label || `Stufe ${v}`, remove: () => toggleMulti('difficulty', v), params: buildRecipeParams(typeFilters, dietFilters, courseFilters, setMinus(difficultyFilters, v), categoryFilters, maxTimeFilter) })),
    ...[...categoryFilters].map(id => ({ key: 'cat-' + id, label: categoryOpts.find(c => String(c.id) === id)?.name || 'Kategorie', remove: () => toggleMulti('category', id), params: buildRecipeParams(typeFilters, dietFilters, courseFilters, difficultyFilters, setMinus(categoryFilters, id), maxTimeFilter) })),
    ...(maxTimeFilter ? [{ key: 'time', label: `Bis ${maxTimeFilter} Min.`, remove: () => toggleTimeFilter(maxTimeFilter), params: buildRecipeParams(typeFilters, dietFilters, courseFilters, difficultyFilters, categoryFilters, 0) }] : []),
  ]

  useEffect(() => {
    if (loading || error || showFavorites || recipes.length > 0 || activeFilterCount === 0) {
      setDiagnosis([])
      return
    }
    let cancelled = false
    Promise.all(diagFilters.map(f =>
      client.get('/api/recipes', { params: f.params, paramsSerializer: { indexes: null } })
        .then(res => ({ label: f.label, plus: res.data.total || 0, remove: f.remove }))
        .catch(() => null)
    )).then(rows => {
      if (cancelled) return
      setDiagnosis(rows.filter(r => r && r.plus > 0).sort((a, b) => b.plus - a.plus))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes.length, loading, error, showFavorites, activeFilterCount, typeKey, dietKey, courseKey, difficultyKey, categoryKey, maxTimeFilter, search, scopeDesc, scopeIng, scopeAuthor, authorFilter, authorIdFilter, sort, reloadNonce])

  // ── Filter-Sheet: Slide-in und Drag-to-close ───────────────────────────────

  const oeffneSheet = () => { setDragY(0); setSheetOpen(true) }

  useEffect(() => {
    if (!sheetOpen) return undefined
    // Erst im nächsten Frame — sonst rendert der Browser gleich den Endzustand
    // und es gibt nichts zu animieren.
    const id = requestAnimationFrame(() => setSheetIn(true))
    return () => cancelAnimationFrame(id)
  }, [sheetOpen])

  const schliesseSheet = () => {
    setDragging(false)
    // Nach unten rausschieben und erst danach abbauen, damit das Sheet nicht
    // aus dem Bild springt.
    setDragY(panelRef.current?.offsetHeight || 400)
    setTimeout(() => { setSheetOpen(false); setSheetIn(false); setDragY(0) }, 220)
  }

  const griffDown = (e) => {
    dragStartRef.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const griffMove = (e) => {
    if (!dragging) return
    // Nur nach unten — nach oben gibt es nichts aufzuziehen.
    setDragY(Math.max(0, e.clientY - dragStartRef.current))
  }

  const griffUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dragY > 90) schliesseSheet()
    else setDragY(0)
  }

  const openDetail = (r) => {
    // Neben der Position auch den Ladestand merken: ohne ihn käme man mit nur
    // einer geladenen Seite zurück und die Position wäre unerreichbar. Die
    // Länge der Liste ist der Ladestand — kein zweiter Zähler nötig.
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify({
      y: window.scrollY,
      h: document.body.scrollHeight,
      geladen: recipes.length,
      key: queryKey,
    }))
    navigate(`/recipes/${r.id}`)
  }

  // Einheitliches Raster: das erste Rezept war beim reinen Blättern eine
  // 16:9-Featured-Karte. Das hat es ohne Grund hervorgehoben — die Reihenfolge
  // ist eine Sortierung, keine Redaktion (BUG-09).
  const renderGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 20, alignItems: 'stretch' }}>
      {recipes.map(r => r.deleted_at
        ? <DeletedFavoriteCard key={r.id} recipe={r} />
        : (
          <div key={r.id} style={{ opacity: showFavorites && !favoriteIds.has(r.id) ? 0.4 : 1, pointerEvents: showFavorites && !favoriteIds.has(r.id) ? 'none' : 'auto' }}>
            <RecipeCard recipe={r} onClick={() => openDetail(r)} />
          </div>
        )
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
        <div>
          {/* Results (Sidebar entfällt — Filter via FAB/Sheet §2.10) */}
          <div style={{ minWidth: 0 }}>

            {/* Toolbar: favorites/author + count + sort (Filter → FAB §2.10) */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>

              {authorFilter && <AuthorFilterChip author={authorFilter} onClear={clearAuthorFilter} />}

              <div style={{ flex: 1 }} />

              {!loading && total > 0 && (
                <span aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.04em', color: 'var(--text-muted)' }}>
                  {total} Treffer{search ? ` für »${search}«` : ''}
                </span>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setSortOpen(o => !o)}
                  data-track-id="recipes-sort-select"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--text)', letterSpacing: '.02em' }}
                >
                  {sortOptions.find(o => o.value === sort)?.label ?? 'Neueste zuerst'}
                  <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
                </button>
                {sortOpen && (
                  <>
                    <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 41, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-hover)', padding: 4, minWidth: 150 }}>
                      {sortOptions.map(o => (
                        <button key={o.value} onClick={() => { setSort(o.value); setSortOpen(false) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: o.value === sort ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none', color: o.value === sort ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Aktive Filter-Chips: entfernt in C1 — wandern in C2 als schwebende Pills (§2.10) */}

            {/* Error banner (Filter bleiben erhalten) */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 'var(--radius-card)', padding: '12px 16px', marginBottom: 20, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)' }}>
                <span>Rezepte konnten nicht geladen werden.</span>
                <button onClick={() => setReloadNonce(n => n + 1)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0, fontFamily: 'var(--font-body)', fontSize: 14 }}>
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
                : <EmptyState search={search} hasActiveFilters={activeFilterCount > 0} diagnosis={diagnosis} onClearFilters={clearAllFilters} />
            ) : renderGrid()}

            {/* Nachladen (Infinite Scroll) statt Seitenblättern */}
            {loadingMore && (
              <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 20, alignItems: 'stretch', marginTop: 20 }}>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Sentinel — steht immer im Baum, damit der Observer ihn beim
                ersten Rendern findet. */}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </div>
        </div>
      </div>

      {/* Schwebende Filter-Ebene (§2.10): Pills links, FAB rechts */}
      <div className="rezepte-fab-layer">
        <div className="rezepte-fab-inner">
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0, overflow: 'hidden', pointerEvents: 'auto' }}>
            {chips.slice(0, 2).map(c => (
              <button
                key={c.key}
                onClick={c.remove}
                data-track-id="recipes-filter-pill-remove"
                aria-label={`Filter ${c.label} entfernen`}
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, letterSpacing: '.04em', padding: '7px 9px 7px 11px', background: 'var(--surface)', color: 'var(--text)', border: 'none', borderRadius: 16, boxShadow: '0 3px 10px rgba(0,0,0,.18)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot || 'var(--text-muted)', flexShrink: 0 }} />
                {c.label}
                <i className="ti ti-x" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
              </button>
            ))}
            {chips.length > 2 && (
              <button
                onClick={oeffneSheet}
                data-track-id="recipes-filter-overflow-open"
                aria-label={`${chips.length - 2} weitere Filter`}
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, letterSpacing: '.04em', padding: '7px 11px', background: 'var(--ink-braun)', color: 'var(--on-dark)', border: 'none', borderRadius: 16, boxShadow: '0 3px 10px rgba(0,0,0,.2)' }}
              >
                +{chips.length - 2}
              </button>
            )}
          </div>
          <button
            onClick={oeffneSheet}
            data-track-id="recipes-filter-fab-open"
            aria-label="Filter"
            style={{ pointerEvents: 'auto', flexShrink: 0, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(80,35,12,.28)' }}
          >
            <i className="ti ti-adjustments-horizontal" style={{ fontSize: 22, color: 'var(--on-accent)' }} />
          </button>
        </div>
      </div>

      {/* Filter-Bottom-Sheet (§2.11) */}
      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={schliesseSheet}
            style={{
              position: 'absolute', inset: 0, background: 'rgba(42,34,24,.4)',
              opacity: sheetIn && dragY === 0 ? 1 : 0.6,
              transition: dragging ? 'none' : 'opacity .22s ease',
            }}
          />
          <div
            ref={panelRef}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85vh',
              background: 'var(--bg)', borderRadius: '12px 12px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,.2)',
              display: 'flex', flexDirection: 'column',
              transform: sheetIn ? `translateY(${dragY}px)` : 'translateY(100%)',
              transition: dragging ? 'none' : 'transform .22s cubic-bezier(.4,0,.2,1)',
              willChange: 'transform',
            }}
          >
            {/* Griff — zieht das Sheet zu (BUG-12). `touchAction: none`, sonst
                scrollt der Browser beim Ziehen die Seite statt das Sheet. */}
            <div
              onPointerDown={griffDown}
              onPointerMove={griffMove}
              onPointerUp={griffUp}
              onPointerCancel={griffUp}
              role="button"
              aria-label="Filter schließen"
              data-track-id="recipes-filter-sheet-grabber"
              style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
            >
              <div style={{ width: 36, height: 4, background: 'var(--wood-shadow)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Filter</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>Zurücksetzen</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
              <FilterPanel groups={groups} />
            </div>
            <div style={{ padding: '12px 20px 24px', borderTop: '1px solid var(--hairline)', flexShrink: 0 }}>
              <button onClick={schliesseSheet} style={{ width: '100%', padding: 14, borderRadius: 4, background: 'var(--ink-braun)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--on-dark)', boxShadow: '0 3px 0 rgba(0,0,0,.25)' }}>
                {total} Rezepte anzeigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
