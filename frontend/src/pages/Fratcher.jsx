import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import BackButton from '../components/BackButton'
import BottomNav from '../components/BottomNav'
import { getCategoryColor, categoryGradient } from '../theme/categoryColors'

// Standard-Basics (Gewürze/Grundzutaten) — Startwert. Ab Commit 2 nutzer-editierbar
// und in localStorage persistiert; werden beim Matching ignoriert (zählen nicht als
// „fehlend"). matchRecipe liest die dynamische Liste, nicht mehr diesen fixen Set.
const DEFAULT_BASICS = [
  'salz','pfeffer','zucker','olivenöl','öl','wasser','essig','brühe',
  'oregano','basilikum','thymian','rosmarin','petersilie','schnittlauch',
  'kreuzkümmel','paprikapulver','kurkuma','zimt','muskat','koriander',
  'lorbeer','chili','curry','cayennepfeffer','backpulver','hefe','natron','vanille',
]
const BASICS_STORAGE_KEY = 'fratcher_basics'

const CATEGORIES = [
  { label: 'Gemüse',          items: ['Tomate','Zwiebel','Knoblauch','Kartoffel','Möhre','Zucchini','Spinat','Paprika','Brokkoli','Champignon','Kürbis','Sellerie','Avocado','Bärlauch'] },
  { label: 'Vorrat',          items: ['Mehl','Reis','Pasta','Brot','Haferflocken','Paniermehl','Linsen','Dosentomaten'] },
  { label: 'Milch & Eier',    items: ['Ei','Milch','Butter','Käse','Sahne','Joghurt','Parmesan','Quark','Mozzarella'] },
  { label: 'Fleisch & Fisch', items: ['Hähnchen','Hackfleisch','Lachs','Thunfisch','Speck','Wurst'] },
  { label: 'Frisches',        items: ['Zitrone','Ingwer','Apfel','Birne','Banane','Beeren','Knoblauchzehe'] },
]

// Wartezeit, bevor eine Zutaten-/Basics-Änderung den Server fragt. Wer drei
// Zutaten hintereinander antippt, löst so einen Request aus, nicht drei.
const ANFRAGE_VERZOEGERUNG = 250

export default function Fratcher() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('kochen')
  const [ingredients, setIngredients] = useState([])
  const [searchText, setSearchText] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [view, setView] = useState('input')
  const [loading, setLoading] = useState(false)
  // Flache Trefferliste vom Server — `pct` und `missing` sind dort schon
  // gerechnet. Die Buckets entstehen daraus weiter unten im Client, damit ein
  // Moduswechsel keinen neuen Request braucht.
  const [treffer, setTreffer] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)

  // Nutzer-editierbare Basics (Commit 2) — Start aus DEFAULT_BASICS, persistiert in localStorage
  const [basics, setBasics] = useState(() => {
    try {
      const raw = localStorage.getItem(BASICS_STORAGE_KEY)
      const arr = raw ? JSON.parse(raw) : null
      if (Array.isArray(arr)) return arr
    } catch { /* ignore — Default nutzen */ }
    return DEFAULT_BASICS
  })
  const [editingBasics, setEditingBasics] = useState(false)
  const [basicText, setBasicText] = useState('')

  useEffect(() => {
    try { localStorage.setItem(BASICS_STORAGE_KEY, JSON.stringify(basics)) } catch { /* ignore */ }
  }, [basics])

  // Ein Call statt bis zu ~75 (Liste + Detail je Rezept + Media je Treffer):
  // Deckung, Prozente und Titelbild kommen fertig vom Server (BUG-57/58).
  // Verglichen wird dort über Synonyme und rapidfuzz — „Tomaten" deckt jetzt
  // „Tomate", was der alte `includes()`-Vergleich hier nicht konnte.
  useEffect(() => {
    if (ingredients.length === 0) {
      setTreffer([])
      setLoading(false)
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      client.post('/api/fratcher/match', { ingredients, basics }, { signal: controller.signal })
        .then(({ data }) => setTreffer(data.matches || []))
        .catch(err => { if (err.name !== 'CanceledError') setTreffer([]) })
        // Nur der noch gültige Lauf darf die Ladeanzeige ausschalten — sonst
        // nimmt ein abgebrochener Vorgänger sie dem gerade laufenden weg.
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, ANFRAGE_VERZOEGERUNG)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ingredients, basics])

  // Buckets aus der Server-Trefferliste — bewusst hier und nicht im Endpoint:
  // ein Moduswechsel ordnet damit nur neu und holt nichts nach.
  const results = useMemo(() => {
    const sofort = [], fast = [], insp = []
    for (const r of treffer) {
      if (r.missing.length === 0) sofort.push(r)
      else if (r.missing.length <= 2) fast.push(r)
      else if (mode === 'inspiration' && r.pct >= 0.5) insp.push(r)
    }
    const byIdDesc = (a, b) => b.id - a.id
    sofort.sort(byIdDesc); fast.sort(byIdDesc); insp.sort(byIdDesc)
    return { sofort, fast, inspiration: insp }
  }, [treffer, mode])

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

  const addBasic = raw => {
    const item = raw.trim()
    setBasicText('')
    if (!item) return
    if (basics.some(b => b.toLowerCase() === item.toLowerCase())) return
    setBasics([...basics, item])
  }
  const removeBasic = item => setBasics(basics.filter(b => b !== item))

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
      borderRadius: 'var(--radius-pill)', cursor: 'pointer',
      fontSize: isMobile ? 13 : 12,
      fontFamily: 'var(--font-body)',
      border: isActive ? '1px solid transparent' : isSugg ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
      background: isActive ? 'var(--green)' : isSugg ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'color-mix(in srgb, var(--green) 10%, transparent)',
      color: isActive ? 'var(--on-accent)' : isSugg ? 'var(--accent)' : 'var(--green)',
      fontWeight: isActive || isSugg ? 600 : 400,
      boxShadow: isSugg ? '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
    }
  }

  const fmtTime = t => !t ? '–' : t < 60 ? `${t} Min.` : `${Math.floor(t / 60)} Std.`
  const missingLabel = n => n === 1 ? '1 fehlt' : `${n} fehlen`
  const catOf = recipe => getCategoryColor(recipe.category)
  const cardImgStyle = recipe => {
    // Beide Größen kommen aus der Antwort — kein Media-Call je Treffer mehr.
    const url = recipe.media?.thumbnail_url || recipe.media?.url
    return url
      ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: categoryGradient(recipe.category) }
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

  // Kategorie·Zeit-Overline (DM Mono, Kategorie-Farbe) — SPEC §09
  const renderCardOverline = recipe => {
    const c = catOf(recipe)
    const label = [c.label || recipe.category, fmtTime(recipe.cook_time)].filter(Boolean).join(' · ')
    if (!label) return null
    return (
      <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: c.base }}>
        {label}
      </p>
    )
  }

  // Match-%-Bar + %-Label (Kategorie-Farbe) — der schon berechnete pct, sichtbar (SPEC §09)
  const renderMatchBar = recipe => {
    const c = catOf(recipe)
    const p = Math.round((recipe.pct ?? 0) * 100)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
        <div style={{ flex: 'none', width: 44, height: 3, borderRadius: 2, background: 'var(--hairline)', overflow: 'hidden' }}>
          <div style={{ width: `${p}%`, height: '100%', background: c.base, borderRadius: 2 }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, letterSpacing: '.02em', color: c.base }}>{p}%</span>
      </div>
    )
  }

  const cardTitleStyle = {
    margin: '0 0 2px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
    fontSize: 15, lineHeight: 1.12, color: 'var(--text)',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  }
  const cardShell = {
    background: 'var(--card)', borderRadius: 'var(--radius-card)', overflow: 'hidden',
    boxShadow: 'var(--shadow-card)', cursor: 'pointer',
  }

  const renderModeToggle = isMobile => (
    <div style={{ background: 'var(--bg-alt)', borderRadius: isMobile ? 13 : 12, padding: 4, display: 'flex', gap: isMobile ? 4 : 3, marginBottom: 24 }}>
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
            fontSize: isMobile ? 14 : 13, fontFamily: 'var(--font-body)', fontWeight: 500,
            cursor: 'pointer', transition: 'var(--transition)',
            background: mode === m ? 'var(--surface)' : 'transparent',
            color: mode === m ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: mode === m ? 'var(--shadow)' : 'none',
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
        border: `1.5px solid ${showAutocomplete && acItems.length > 0 ? 'var(--green)' : 'var(--border-input)'}`,
        borderRadius: isMobile ? 13 : 12,
        padding: isMobile ? '11px 14px' : '10px 13px',
        boxShadow: 'var(--shadow)', transition: 'border-color .15s',
      }}>
        <i className="ti ti-search" style={{ fontSize: 16, color: 'var(--green)', flexShrink: 0 }} />
        <input
          type="text"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setShowAutocomplete(e.target.value.length > 0); setActiveIndex(-1) }}
          onFocus={() => setShowAutocomplete(searchText.length > 0)}
          onBlur={() => setTimeout(() => { setShowAutocomplete(false); setActiveIndex(-1) }, 180)}
          onKeyDown={e => {
            if (!showAutocomplete || acItems.length === 0) return
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.preventDefault()
            if (e.key === 'ArrowDown') setActiveIndex(prev => Math.min(prev + 1, acItems.length - 1))
            else if (e.key === 'ArrowUp') setActiveIndex(prev => Math.max(prev - 1, 0))
            else if (e.key === 'Enter' && activeIndex >= 0) { addIngredient(acItems[activeIndex]); setActiveIndex(-1) }
            else if (e.key === 'Escape') { setShowAutocomplete(false); setActiveIndex(-1) }
          }}
          placeholder={isMobile ? 'Zutat eingeben …' : 'Zutat suchen …'}
          data-track-id="fratcher-search-input"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: isMobile ? 15 : 14, color: 'var(--text)' }}
        />
        {searchText && (
          <button
            onClick={() => { setSearchText(''); setShowAutocomplete(false) }}
            style={{ width: 18, height: 18, borderRadius: 'var(--radius-pill)', background: 'var(--bg-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, cursor: 'pointer' }}
          >
            <i className="ti ti-x" style={{ fontSize: 10, color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>
      {showAutocomplete && acItems.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 13, boxShadow: 'var(--shadow-hover)', zIndex: 50, overflow: 'hidden' }}>
          {acItems.map((item, idx) => (
            <button
              key={item}
              onMouseDown={() => addIngredient(item)}
              style={{ width: '100%', padding: isMobile ? '12px 16px' : '10px 14px', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 9, background: idx === activeIndex ? 'var(--bg)' : 'transparent', border: 'none', borderBottom: '1px solid var(--hairline)', textAlign: 'left', cursor: 'pointer' }}
            >
              <i className="ti ti-leaf" style={{ fontSize: isMobile ? 14 : 13, color: 'var(--green)', flexShrink: 0 }} />
              <span style={{ fontSize: isMobile ? 14 : 13, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{item}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderCategories = isMobile => CATEGORIES.map(cat => (
    <div key={cat.label} style={{ marginBottom: isMobile ? 18 : 16 }}>
      <p style={{ fontSize: 10, fontWeight: 400, color: 'var(--green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: isMobile ? 8 : 7 }}>{cat.label}</p>
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
    <div style={{ marginTop: 8, paddingTop: isMobile ? 20 : 18, borderTop: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 10 }}>
        <p style={{ fontSize: isMobile ? 10 : 9, fontWeight: 400, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Im Kühlschrank</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <button data-track-id="fratcher-clear-all" onClick={clearAll} style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
              Alle löschen
            </button>
          )}
          <div style={{ background: 'var(--green)', borderRadius: 'var(--radius-pill)', padding: '2px 9px', minWidth: 22, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-accent)', fontFamily: 'var(--font-mono)' }}>{ingredients.length}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 7 : 6 }}>
        {ingredients.map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 5, background: 'var(--green)', borderRadius: 'var(--radius-pill)', padding: isMobile ? '6px 12px' : '5px 10px' }}>
            <span style={{ fontSize: isMobile ? 13 : 12, color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{item}</span>
            <button
              data-track-id="fratcher-ingredient-remove"
              onClick={() => removeIngredient(item)}
              style={{ width: isMobile ? 16 : 14, height: isMobile ? 16 : 14, borderRadius: 'var(--radius-pill)', background: 'color-mix(in srgb, var(--on-accent) 22%, transparent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, cursor: 'pointer' }}
            >
              <i className="ti ti-x" style={{ fontSize: isMobile ? 9 : 8, color: 'var(--on-accent)' }} />
            </button>
          </div>
        ))}
        {isMobile && (
          <button data-track-id="fratcher-clear-all" onClick={clearAll} style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'transparent', border: '1px dashed var(--border-input)', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            Alle löschen
          </button>
        )}
      </div>
    </div>
  )

  // Editierbare Basics (SPEC §09) — muted Chips, „werden ignoriert", Bearbeiten-Toggle
  const renderBasics = isMobile => (
    <div style={{ marginTop: 8, paddingTop: isMobile ? 20 : 18, borderTop: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 10 }}>
        <p style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: isMobile ? 10 : 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Basics
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>· zählen nicht als fehlend</span>
        </p>
        <button
          data-track-id="fratcher-basics-edit-toggle"
          onClick={() => setEditingBasics(v => !v)}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: isMobile ? 10 : 9, letterSpacing: '.04em', color: 'var(--accent)' }}
        >
          {editingBasics ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {basics.map(item => (
          <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg-alt)', color: 'var(--text-muted)', borderRadius: 'var(--radius-pill)', padding: isMobile ? '5px 10px' : '5px 9px', fontFamily: 'var(--font-body)', fontSize: 10 }}>
            {item}
            {editingBasics && (
              <button
                data-track-id="fratcher-basic-remove"
                onClick={() => removeBasic(item)}
                aria-label={`${item} entfernen`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}
              >
                <i className="ti ti-x" style={{ fontSize: 9 }} />
              </button>
            )}
          </span>
        ))}
      </div>
      {editingBasics && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            type="text"
            value={basicText}
            onChange={e => setBasicText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBasic(basicText) } }}
            placeholder="Basic hinzufügen …"
            data-track-id="fratcher-basic-input"
            style={{ flex: 1, minWidth: 0, background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', padding: '8px 11px', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}
          />
          <button
            data-track-id="fratcher-basic-add"
            onClick={() => addBasic(basicText)}
            style={{ flexShrink: 0, background: 'var(--green)', color: 'var(--on-accent)', border: 'none', borderRadius: 'var(--radius-input)', padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  )

  const renderSofortCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={cardShell}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'color-mix(in srgb, var(--green-strong) 90%, transparent)', borderRadius: 'var(--radius-pill)', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ti ti-check" style={{ fontSize: 10, color: 'var(--on-accent)' }} />
          <span style={{ fontSize: 10, color: 'var(--on-accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Sofort</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '9px 11px 11px' : '10px 12px 12px' }}>
        {renderCardOverline(recipe)}
        <p style={cardTitleStyle}>{recipe.title}</p>
        {renderMatchBar(recipe)}
      </div>
    </div>
  )

  const renderFastCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={cardShell}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'color-mix(in srgb, var(--accent) 90%, transparent)', borderRadius: 'var(--radius-pill)', padding: '3px 9px' }}>
          <span style={{ fontSize: 10, color: 'var(--on-accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{missingLabel(recipe.missing.length)}</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '9px 11px 11px' : '10px 12px 12px' }}>
        {renderCardOverline(recipe)}
        <p style={cardTitleStyle}>{recipe.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {recipe.missing.map(chip => (
            <div key={chip} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>
              <i className="ti ti-plus" style={{ fontSize: 9, color: 'var(--accent)' }} />
              <span style={{ fontSize: isMobile ? 10 : 11, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{chip}</span>
            </div>
          ))}
        </div>
        {renderMatchBar(recipe)}
      </div>
    </div>
  )

  const renderInspirationCard = (recipe, isMobile) => (
    <div
      key={recipe.id}
      data-track-id="fratcher-result-card-click"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={{ ...cardShell, opacity: .85 }}
    >
      <div style={{ height: isMobile ? 120 : 128, position: 'relative', ...cardImgStyle(recipe) }}>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'color-mix(in srgb, var(--blue) 85%, transparent)', borderRadius: 'var(--radius-pill)', padding: '3px 9px' }}>
          <span style={{ fontSize: 10, color: 'var(--on-accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{missingLabel(recipe.missing.length)}</span>
        </div>
      </div>
      <div style={{ padding: isMobile ? '9px 11px 11px' : '10px 12px 12px' }}>
        {renderCardOverline(recipe)}
        <p style={cardTitleStyle}>{recipe.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {recipe.missing.map(chip => (
            <div key={chip} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-alt)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>
              <i className="ti ti-plus" style={{ fontSize: 9, color: 'var(--text-muted)' }} />
              <span style={{ fontSize: isMobile ? 10 : 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{chip}</span>
            </div>
          ))}
        </div>
        {renderMatchBar(recipe)}
      </div>
    </div>
  )

  const renderResults = isMobile => (
    <>
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>Laden …</div>
      )}
      {!loading && totalCount > 0 && (
        <p style={{ margin: isMobile ? '0 4px 14px' : '0 0 16px', fontFamily: 'var(--font-body)', fontSize: isMobile ? 11 : 12, color: 'var(--text-muted)' }}>
          Basics (Salz, Öl, Mehl …) werden ignoriert.
        </p>
      )}
      {!loading && results.sofort.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--green-strong)', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 12 : 11, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.1em', flex: 1 }}>Sofort kochbar</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{results.sofort.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.sofort.map(r => renderSofortCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && results.fast.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--accent)', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 12 : 11, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.1em', flex: 1 }}>Fast komplett</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{results.fast.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.fast.map(r => renderFastCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && results.inspiration.length > 0 && (
        <div style={{ marginBottom: isMobile ? 24 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 12 : 14, padding: isMobile ? '0 4px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--blue)', flexShrink: 0 }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 12 : 11, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.1em', flex: 1 }}>Inspiration</h3>
            <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{results.inspiration.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 11 }}>
            {results.inspiration.map(r => renderInspirationCard(r, isMobile))}
          </div>
        </div>
      )}
      {!loading && hasIng && totalCount === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '48px 24px' : '80px 32px', textAlign: 'center' }}>
          <div style={{ width: isMobile ? 72 : 80, height: isMobile ? 72 : 80, borderRadius: 'var(--radius-pill)', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 20 : 22 }}>
            <i className="ti ti-fridge-off" style={{ fontSize: isMobile ? 32 : 36, color: 'var(--text-muted)' }} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: isMobile ? 20 : 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Keine Treffer</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6, maxWidth: isMobile ? 240 : 280 }}>{emptyHint}</p>
          {showInspirationCta && (
            <button
              data-track-id="fratcher-inspiration-cta-click"
              onClick={() => setMode('inspiration')}
              style={{ marginTop: isMobile ? 22 : 24, background: 'var(--green)', color: 'var(--on-accent)', border: 'none', borderRadius: 'var(--radius-pill)', padding: isMobile ? '12px 24px' : '13px 26px', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 8, cursor: 'pointer' }}
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
        <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--hairline)', padding: '12px 16px 11px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Aus der Ergebnisliste führt „Zurück" eine Stufe in die Eingabe, nicht
              aus dem Fratcher heraus. */}
          <BackButton onClick={() => view === 'results' ? setView('input') : navigate(-1)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--ink-gruen), var(--green))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-fridge" style={{ fontSize: 15, color: 'var(--on-dark)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.3px' }}>Fratcher</span>
          </div>
          {view === 'results' && (
            <button onClick={() => setView('input')} style={{ fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-body)', fontWeight: 500, background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer' }}>
              Zutaten ändern
            </button>
          )}
        </div>

        {/* Input View */}
        {view === 'input' && (
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px 16px 180px' }}>
            {renderModeToggle(true)}
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 6 }}>Was hast du im Kühlschrank?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>{modeHint}</p>
            {renderSearchField(true)}
            {renderCategories(true)}
            {renderIngredientTags(true)}
            {renderBasics(true)}
          </div>
        )}

        {/* Results View */}
        {view === 'results' && (
          <>
            {/* Ingredient summary bar */}
            <div style={{ flexShrink: 0, padding: '10px 16px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <i className="ti ti-fridge" style={{ fontSize: 15, color: 'var(--green)', flexShrink: 0 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {ingredients.map(item => (
                  <div key={item} style={{ flexShrink: 0, background: 'color-mix(in srgb, var(--green) 16%, transparent)', borderRadius: 'var(--radius-pill)', padding: '3px 10px' }}>
                    <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-body)', fontWeight: 500, whiteSpace: 'nowrap' }}>{item}</span>
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
          <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, padding: '10px 16px 12px', background: 'var(--bg)', borderTop: '1px solid var(--hairline)', zIndex: 20 }}>
            <button
              data-track-id="fratcher-search-submit"
              onClick={handleSearch}
              disabled={ctaDisabled}
              style={{
                width: '100%', padding: 15, borderRadius: 'var(--radius-input)', border: 'none',
                background: ctaDisabled ? 'var(--border-input)' : 'var(--green)',
                color: ctaDisabled ? 'var(--text-muted)' : 'var(--on-accent)',
                fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 600,
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
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--hairline)', padding: '14px 32px 13px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <BackButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--ink-gruen), var(--green))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-fridge" style={{ fontSize: 16, color: 'var(--on-dark)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.3px' }}>Fratcher</span>
          </div>
        </div>

        {/* 2-Panel */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>

          {/* Sidebar */}
          <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 65, maxHeight: 'calc(100vh - 65px)', overflowY: 'auto', padding: '24px 20px 32px 32px', borderRight: '1px solid var(--hairline)' }}>
            {renderModeToggle(false)}
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 18, lineHeight: 1.5 }}>{modeHint}</p>
            {renderSearchField(false)}
            {renderCategories(false)}
            {renderIngredientTags(false)}
            {renderBasics(false)}
          </div>

          {/* Results Panel */}
          <div style={{ flex: 1, minWidth: 0, padding: '24px 32px 0 28px' }}>
            {!hasIng ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', textAlign: 'center' }}>
                <div style={{ width: 88, height: 88, borderRadius: 'var(--radius-pill)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--green) 16%, var(--surface)), color-mix(in srgb, var(--green) 7%, var(--surface)))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <i className="ti ti-fridge" style={{ fontSize: 38, color: 'var(--green)' }} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-.3px' }}>Was hast du im Kühlschrank?</h3>
                <p style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6, maxWidth: 300 }}>Wähle Zutaten aus der Liste links — die passenden Rezepte erscheinen sofort hier.</p>
              </div>
            ) : renderResults(false)}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  )
}
