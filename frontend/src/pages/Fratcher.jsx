import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import BottomNav from '../components/BottomNav'

const STAPLES = new Set([
  'salz','pfeffer','zucker','olivenöl','öl','wasser','essig','brühe',
  'oregano','basilikum','thymian','rosmarin','petersilie','schnittlauch',
  'kreuzkümmel','paprikapulver','kurkuma','zimt','muskat','koriander',
  'lorbeer','chili','curry','cayennepfeffer','backpulver','hefe','natron','vanille',
])

const CATEGORIES = [
  { label: 'Gemüse',          items: ['Tomate','Zwiebel','Knoblauch','Kartoffel','Möhre','Zucchini','Spinat','Paprika','Brokkoli','Champignon','Kürbis','Sellerie','Avocado','Bärlauch'] },
  { label: 'Vorrat',          items: ['Mehl','Reis','Pasta','Brot','Haferflocken','Paniermehl','Linsen','Dosentomaten'] },
  { label: 'Milch & Eier',    items: ['Ei','Milch','Butter','Käse','Sahne','Joghurt','Parmesan','Quark','Mozzarella'] },
  { label: 'Fleisch & Fisch', items: ['Hähnchen','Hackfleisch','Lachs','Thunfisch','Speck','Wurst'] },
  { label: 'Frisches',        items: ['Zitrone','Ingwer','Apfel','Birne','Banane','Beeren','Knoblauchzehe'] },
]

function matchRecipe(recipe, userIngredients) {
  const ui = userIngredients.map(i => i.toLowerCase())
  const recipeIngredients = recipe.ingredients?.map(i => i.name) || []
  const relevant = recipeIngredients.filter(ing => !STAPLES.has(ing.toLowerCase()))
  if (relevant.length === 0) return { missing: [], pct: 0, skip: true }
  const missing = relevant.filter(ing => !ui.includes(ing.toLowerCase()))
  const pct = (relevant.length - missing.length) / relevant.length
  return { missing, pct }
}

export default function Fratcher() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('kochen')
  const [ingredients, setIngredients] = useState([])
  const [searchText, setSearchText] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [view, setView] = useState('input')
  const [results, setResults] = useState({ sofort: [], fast: [], inspiration: [] })
  const [loading, setLoading] = useState(false)
  const [allRecipes, setAllRecipes] = useState([])
  const [recipeImgs, setRecipeImgs] = useState({})
  const [activeIndex, setActiveIndex] = useState(-1)
  const imgFetchedRef = useRef(new Set())

  // Fetch recipe list, then all individual details (needed for ingredients)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await client.get('/api/recipes', { params: { page_size: 50 } })
        const list = data.items || []
        const details = await Promise.all(
          list.map(r => client.get(`/api/recipes/${r.id}`).then(res => res.data).catch(() => r))
        )
        setAllRecipes(details)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Recompute matches whenever ingredients, mode, or recipe data changes
  useEffect(() => {
    if (ingredients.length === 0) {
      setResults({ sofort: [], fast: [], inspiration: [] })
      return
    }
    const sofort = [], fast = [], insp = []
    allRecipes.forEach(recipe => {
      const { missing, pct, skip } = matchRecipe(recipe, ingredients)
      if (skip) return
      if (missing.length === 0) sofort.push({ ...recipe, missing })
      else if (missing.length <= 2) fast.push({ ...recipe, missing })
      else if (mode === 'inspiration' && pct >= 0.5) insp.push({ ...recipe, missing })
    })
    const byIdDesc = (a, b) => b.id - a.id
    sofort.sort(byIdDesc); fast.sort(byIdDesc); insp.sort(byIdDesc)
    setResults({ sofort, fast, inspiration: insp })

    // Lazy image fetching for matched recipes (cached via ref)
    const toFetch = [...sofort, ...fast, ...insp].slice(0, 24)
    toFetch.forEach(r => {
      if (imgFetchedRef.current.has(r.id)) return
      imgFetchedRef.current.add(r.id)
      client.get(`/api/media/entity/recipe/${r.id}`)
        .then(({ data: media }) => {
          const img = media.find(m => m.is_primary && m.media_type === 'image') ?? null
          setRecipeImgs(prev => ({ ...prev, [r.id]: img?.thumbnail_url || img?.url || null }))
        })
        .catch(() => {})
    })
  }, [ingredients, mode, allRecipes])

  // Autocomplete: client-side from CATEGORIES only
  const allCategoryItems = CATEGORIES.flatMap(c => c.items)
  const acItems = searchText.length > 0
    ? allCategoryItems.filter(i => i.toLowerCase().startsWith(searchText.toLowerCase()) && !ingredients.includes(i)).slice(0, 5)
    : []

  const addIngredient = item => {
    if (ingredients.includes(item)) return
    const next = [...ingredients, item]
    setIngredients(next)
    setSearchText('')
    setShowAutocomplete(false)
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'fratcher_search', ingredient_count: next.length })
  }

  const removeIngredient = item => {
    const next = ingredients.filter(x => x !== item)
    setIngredients(next)
    if (next.length === 0) setView('input')
  }

  const clearAll = () => { setIngredients([]); setView('input') }

  const handleSearch = () => {
    if (!hasIng) return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'fratcher_search', ingredient_count: ingredients.length })
    setView('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setShowAutocomplete(false)
  }

  const totalCount = results.sofort.length + results.fast.length + results.inspiration.length
  const hasIng = ingredients.length > 0
  const suggested = new Set(results.fast.flatMap(r => r.missing.map(m => m.toLowerCase())))

  const chipStyle = (item, isMobile) => {
    const isActive = ingredients.includes(item)
    const isSugg = !isActive && suggested.has(item.toLowerCase())
    return {
      flexShrink: 0,
      padding: isMobile ? '5px 13px' : '4px 11px',
      borderRadius: 999, cursor: 'pointer',
      fontSize: isMobile ? 13 : 12,
      fontFamily: 'Inter, sans-serif',
      border: isActive ? 'none' : isSugg ? '1.5px solid #C8602A' : '1px solid rgba(107,124,78,.25)',
      background: isActive ? '#6B7C4E' : isSugg ? '#FDF0EA' : '#EEF3E8',
      color: isActive ? '#fff' : isSugg ? '#A04E22' : '#4A6B30',
      fontWeight: isActive || isSugg ? 600 : 400,
      boxShadow: isSugg ? '0 0 0 3px rgba(200,96,42,.1)' : 'none',
    }
  }

  const fmtTime = t => !t ? '–' : t < 60 ? `${t} Min.` : `${Math.floor(t / 60)} Std.`
  const missingLabel = n => n === 1 ? '1 fehlt' : `${n} fehlen`
  const cardImgStyle = recipe => {
    const url = recipeImgs[recipe.id]
    return url
      ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: 'linear-gradient(148deg, #8A7A6A, #5A4A3A)' }
  }

  const modeHint = mode === 'kochen'
    ? 'Nur Rezepte, die du jetzt (fast) kochen kannst.'
    : 'Lass dich inspirieren — auch wenn noch etwas fehlt.'

  const emptyHint = mode === 'kochen'
    ? ingredients.length < 4
      ? 'Füge noch mehr Zutaten hinzu — Treffer erscheinen, sobald ein Rezept fast vollständig ist.'
      : 'Mit diesen Zutaten konnten wir keine passenden Rezepte finden. Versuch den Inspiration-Modus!'
    : 'Auch im Inspiration-Modus keine Treffer. Füge mehr Zutaten hinzu.'

  const showInspirationCta = hasIng && totalCount === 0 && mode === 'kochen' && ingredients.length >= 4

  // ── Render helpers (functions, not components, to avoid unmount issues) ──

  const renderModeToggle = isMobile => (
    <div style={{ background: '#EEEBE5', borderRadius: isMobile ? 13 : 12, padding: 4, display: 'flex', gap: isMobile ? 4 : 3, marginBottom: 24 }}>
      {[
        { m: 'kochen',      icon: 'ti-clock',    label: 'Jetzt kochen', trackId: 'fratcher-mode-kochen-toggle' },
        { m: 'inspiration', icon: 'ti-sparkles', label: 'Inspiration',  trackId: 'fratcher-mode-inspiration-toggle' },
      ].map(({ m, icon, label, trackId }) => (
        <button
          key={m}
          data-track-id={trackId}
          onClick={() => setMode(m)}
          style={{
            flex: 1, height: isMobile ? 40 : 36, borderRadius: isMobile ? 9 : 8, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: isMobile ? 14 : 13, fontFamily: 'Inter, sans-serif', fontWeight: 500,
            cursor: 'pointer', transition: 'all .15s',
            background: mode === m ? '#fff' : 'transparent',
            color: mode === m ? '#2C2C2A' : '#9A958C',
            boxShadow: mode === m ? '0 1px 5px rgba(0,0,0,.12)' : 'none',
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: isMobile ? 15 : 14 }} />
          {label}
        </button>
      ))}
    </div>
  )

  const renderSearchField = isMobile => (
    <div style={{ position: 'relative', marginBottom: 22 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)',
        border: `1.5px solid ${showAutocomplete && acItems.length > 0 ? '#6B7C4E' : '#D8D4CD'}`,
        borderRadius: isMobile ? 13 : 12,
        padding: isMobile ? '11px 14px' : '10px 13px',
        boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'border-color .15s',
      }}>
        <i className="ti ti-search" style={{ fontSize: 16, color: '#6B7C4E', flexShrink: 0 }} />
        <input
          type="text"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setShowAutocomplete(e.target.value.length > 0); setActiveIndex(-1) }}
          onFocus={() => setShowAutocomplete(searchText.length > 0)}
          onBlur={() => setTimeout(() => { setShowAutocomplete(false); setActiveIndex(-1) }, 180)}
          onKeyDown={e => {
            if (!showAutocomplete || acItems.length === 0) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, acItems.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)) }
            else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); addIngredient(acItems[activeIndex]); setActiveIndex(-1) }
            else if (e.key === 'Escape') { setShowAutocomplete(false); setActiveIndex(-1) }
          }}
          placeholder={isMobile ? 'Zutat eingeben …' : 'Zutat suchen …'}
          data-track-id="fratcher-search-input"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: isMobile ? 15 : 14, color: 'var(--text)' }}
        />
        {searchText && (
          <button
            onClick={() => { setSearchText(''); setShowAutocomplete(false) }}
            style={{ width: 18, height: 18, borderRadius: 999, background: '#E0DDD8', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, cursor: 'pointer' }}
          >
            <i className="ti ti-x" style={{ fontSize: 10, color: '#6B6B68' }} />
          </button>
        )}
      </div>
      {showAutocomplete && acItems.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--card)', border: '1px solid rgba(0,0,0,.09)', borderRadius: 13, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden' }}>
          {acItems.map((item, idx) => (
            <button
              key={item}
              onMouseDown={() => addIngredient(item)}
              style={{ width: '100%', padding: isMobile ? '12px 16px' : '10px 14px', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 9, background: idx === activeIndex ? 'var(--bg)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(0,0,0,.05)', textAlign: 'left', cursor: 'pointer' }}
            >
              <i className="ti ti-leaf" style={{ fontSize: isMobile ? 14 : 13, color: '#6B7C4E', flexShrink: 0 }} />
              <span style={{ fontSize: isMobile ? 14 : 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{item}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderCategories = isMobile => CATEGORIES.map(cat => (
    <div key={cat.label} style={{ marginBottom: isMobile ? 18 : 16 }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#6B7C4E', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: isMobile ? 8 : 7 }}>{cat.label}</p>
      <div style={{ display: 'flex', gap: isMobile ? 7 : 6, flexWrap: 'wrap' }}>
        {cat.items.map(item => (
          <button
            key={item}
            data-track-id="fratcher-ingredient-add"
            onClick={() => ingredients.includes(item) ? removeIngredient(item) : addIngredient(item)}
            style={chipStyle(item, isMobile)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  ))

  const renderIngredientTags = isMobile => hasIng && (
    <div style={{ marginTop: 8, paddingTop: isMobile ? 20 : 18, borderTop: '1px solid rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 10 }}>
        <p style={{ fontSize: isMobile ? 12 : 11, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '.4px' }}>Deine Zutaten</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <button data-track-id="fratcher-clear-all" onClick={clearAll} style={{ fontSize: 12, color: '#9A958C', fontFamily: 'Inter, sans-serif', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
              Alle löschen
            </button>
          )}
          <div style={{ background: '#6B7C4E', borderRadius: 999, padding: '2px 9px', minWidth: 22, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', fontFamily: 'Inter, sans-serif' }}>{ingredients.length}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 7 : 6 }}>
        {ingredients.map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 5, background: '#EEF3E8', border: '1px solid rgba(107,124,78,.25)', borderRadius: 999, padding: isMobile ? '6px 12px' : '5px 10px' }}>
            <span style={{ fontSize: isMobile ? 13 : 12, color: '#3A5228', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{item}</span>
            <button
              data-track-id="fratcher-ingredient-remove"
              onClick={() => removeIngredient(item)}
              style={{ width: isMobile ? 16 : 14, height: isMobile ? 16 : 14, borderRadius: 999, background: 'rgba(107,124,78,.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, cursor: 'pointer' }}
            >
              <i className="ti ti-x" style={{ fontSize: isMobile ? 9 : 8, color: '#4A6B30' }} />
            </button>
          </div>
        ))}
        {isMobile && (
          <button data-track-id="fratcher-clear-all" onClick={clearAll} style={{ padding: '6px 12px', borderRadius: 999, background: 'transparent', border: '1px dashed rgba(0,0,0,.15)', fontSize: 12, color: '#9A958C', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
            Alle löschen
          </button>
        )}
      </div>
    </div>
  )

  const renderSofortCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={{ background: 'var(--card)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.07)', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(74,138,64,.9)', borderRadius: 999, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />
          <span style={{ fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Sofort</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '8px 10px 10px' : '9px 11px 11px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', marginBottom: 4, lineHeight: 1.3 }}>{recipe.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 4 }}>
          <i className="ti ti-clock" style={{ fontSize: isMobile ? 10 : 11, color: '#9A958C' }} />
          <span style={{ fontSize: isMobile ? 11 : 12, color: '#6B6B68', fontFamily: 'Inter, sans-serif' }}>{fmtTime(recipe.cook_time)}</span>
        </div>
      </div>
    </div>
  )

  const renderFastCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={{ background: 'var(--card)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.07)', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(180,80,30,.88)', borderRadius: 999, padding: '3px 9px' }}>
          <span style={{ fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{missingLabel(recipe.missing.length)}</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '8px 10px 10px' : '9px 11px 11px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', marginBottom: 5, lineHeight: 1.35 }}>{recipe.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {recipe.missing.map(chip => (
            <div key={chip} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FDF0EA', borderRadius: 999, padding: '2px 7px' }}>
              <i className="ti ti-plus" style={{ fontSize: 9, color: '#C8602A' }} />
              <span style={{ fontSize: isMobile ? 10 : 11, color: '#C8602A', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{chip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderInspirationCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={{ background: 'var(--card)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.07)', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)', opacity: .85 }}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(80,60,120,.8)', borderRadius: 999, padding: '3px 9px' }}>
          <span style={{ fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{missingLabel(recipe.missing.length)}</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '8px 10px 10px' : '9px 11px 11px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', marginBottom: 5, lineHeight: 1.35 }}>{recipe.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {recipe.missing.map(chip => (
            <div key={chip} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#F0EDE8', borderRadius: 999, padding: '2px 7px' }}>
              <i className="ti ti-plus" style={{ fontSize: 9, color: '#9A958C' }} />
              <span style={{ fontSize: isMobile ? 10 : 11, color: '#6B6B68', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{chip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderResults = isMobile => (
    <>
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#9A958C', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Laden …</div>
      )}
      {!loading && results.sofort.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: '#4A8A40', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: isMobile ? 13 : 12, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: isMobile ? '.5px' : '.6px', flex: 1 }}>Sofort kochbar</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: '#9A958C', fontFamily: 'Inter, sans-serif' }}>{results.sofort.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.sofort.map(r => renderSofortCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && results.fast.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: '#C8602A', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: isMobile ? 13 : 12, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: isMobile ? '.5px' : '.6px', flex: 1 }}>Fast komplett</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: '#9A958C', fontFamily: 'Inter, sans-serif' }}>{results.fast.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.fast.map(r => renderFastCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && results.inspiration.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: '#9A7AB8', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: isMobile ? 13 : 12, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: isMobile ? '.5px' : '.6px', flex: 1 }}>Inspiration</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: '#9A958C', fontFamily: 'Inter, sans-serif' }}>{results.inspiration.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.inspiration.map(r => renderInspirationCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && hasIng && totalCount === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '48px 24px' : '80px 32px', textAlign: 'center' }}>
          <div style={{ width: isMobile ? 72 : 80, height: isMobile ? 72 : 80, borderRadius: 999, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 20 : 22 }}>
            <i className="ti ti-fridge-off" style={{ fontSize: isMobile ? 32 : 36, color: '#C8C4BC' }} />
          </div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 20 : 22, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Keine Treffer</h3>
          <p style={{ fontSize: 14, color: '#9A958C', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, maxWidth: isMobile ? 240 : 280 }}>{emptyHint}</p>
          {showInspirationCta && (
            <button
              data-track-id="fratcher-inspiration-cta-click"
              onClick={() => setMode('inspiration')}
              style={{ marginTop: isMobile ? 22 : 24, background: '#6B7C4E', color: '#fff', border: 'none', borderRadius: 999, padding: isMobile ? '12px 24px' : '13px 26px', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 8, cursor: 'pointer' }}
            >
              <i className="ti ti-sparkles" style={{ fontSize: 15 }} />
              Inspiration-Modus probieren
            </button>
          )}
        </div>
      )}
    </>
  )

  const ctaDisabled = !hasIng
  const ctaLabel = ctaDisabled ? 'Zutaten auswählen' : `${totalCount} Rezept${totalCount !== 1 ? 'e' : ''} gefunden`

  return (
    <>
      {/* ══ Mobile (< md) ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:hidden" style={{ height: '100dvh', position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,.05)', padding: '12px 16px 11px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => view === 'results' ? setView('input') : navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--card)', border: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 17, color: 'var(--text)' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #3E5228, #6B7C4E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-fridge" style={{ fontSize: 15, color: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 19, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.3px' }}>Fratcher</span>
          </div>
          {view === 'results' && (
            <button onClick={() => setView('input')} style={{ fontSize: 13, color: '#6B7C4E', fontFamily: 'Inter, sans-serif', fontWeight: 500, background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer' }}>
              Zutaten ändern
            </button>
          )}
        </div>

        {/* Input View */}
        {view === 'input' && (
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px 16px 180px' }}>
            {renderModeToggle(true)}
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 6 }}>Was hast du im Kühlschrank?</h2>
            <p style={{ fontSize: 13, color: '#9A958C', fontFamily: 'Inter, sans-serif', marginBottom: 20, lineHeight: 1.5 }}>{modeHint}</p>
            {renderSearchField(true)}
            {renderCategories(true)}
            {renderIngredientTags(true)}
          </div>
        )}

        {/* Results View */}
        {view === 'results' && (
          <>
            {/* Ingredient summary bar */}
            <div style={{ flexShrink: 0, padding: '10px 16px', background: '#EEF3E8', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <i className="ti ti-fridge" style={{ fontSize: 15, color: '#4A6B30', flexShrink: 0 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {ingredients.map(item => (
                  <div key={item} style={{ flexShrink: 0, background: 'rgba(107,124,78,.15)', borderRadius: 999, padding: '3px 10px' }}>
                    <span style={{ fontSize: 12, color: '#3A5228', fontFamily: 'Inter, sans-serif', fontWeight: 500, whiteSpace: 'nowrap' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 12px 80px' }}>
              {renderResults(true)}
            </div>
          </>
        )}

        {/* CTA (only in input view, above BottomNav) */}
        {view === 'input' && (
          <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, padding: '10px 16px 12px', background: 'var(--bg)', borderTop: '1px solid rgba(0,0,0,.06)', zIndex: 20 }}>
            <button
              data-track-id="fratcher-search-submit"
              onClick={handleSearch}
              disabled={ctaDisabled}
              style={{
                width: '100%', padding: 15, borderRadius: 14, border: 'none',
                background: ctaDisabled ? '#D0CCC6' : '#6B7C4E',
                color: ctaDisabled ? '#9A958C' : '#fff',
                fontSize: 15, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: ctaDisabled ? 'default' : 'pointer',
              }}
            >
              <i className={`ti ${ctaDisabled ? 'ti-leaf' : 'ti-arrow-right'}`} style={{ fontSize: 17 }} />
              {ctaLabel}
            </button>
          </div>
        )}
      </div>

      {/* ══ Desktop (≥ md) ═════════════════════════════════════════════════════ */}
      <div className="hidden md:block" style={{ maxWidth: 960, margin: '0 auto', minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>

        {/* Sticky Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,.06)', padding: '14px 32px 13px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--card)', border: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 17, color: 'var(--text)' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #3E5228, #6B7C4E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-fridge" style={{ fontSize: 16, color: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.3px' }}>Fratcher</span>
          </div>
        </div>

        {/* 2-Panel */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>

          {/* Sidebar */}
          <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 65, maxHeight: 'calc(100vh - 65px)', overflowY: 'auto', padding: '24px 20px 32px 32px', borderRight: '1px solid rgba(0,0,0,.06)' }}>
            {renderModeToggle(false)}
            <p style={{ fontSize: 13, color: '#9A958C', fontFamily: 'Inter, sans-serif', marginBottom: 18, lineHeight: 1.5 }}>{modeHint}</p>
            {renderSearchField(false)}
            {renderCategories(false)}
            {renderIngredientTags(false)}
          </div>

          {/* Results Panel */}
          <div style={{ flex: 1, minWidth: 0, padding: '24px 32px 0 28px' }}>
            {!hasIng ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', textAlign: 'center' }}>
                <div style={{ width: 88, height: 88, borderRadius: 999, background: 'linear-gradient(135deg, #EEF3E8, #E0EAD4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <i className="ti ti-fridge" style={{ fontSize: 38, color: '#6B7C4E' }} />
                </div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: 'var(--text)', marginBottom: 10, letterSpacing: '-.3px' }}>Was hast du im Kühlschrank?</h3>
                <p style={{ fontSize: 15, color: '#9A958C', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, maxWidth: 300 }}>Wähle Zutaten aus der Liste links — die passenden Rezepte erscheinen sofort hier.</p>
              </div>
            ) : renderResults(false)}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  )
}
