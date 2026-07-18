import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import BackButton from '../components/BackButton'
import { getCategoryColor, getCategoryGroup, CATEGORY_GROUP_ORDER } from '../theme/categoryColors'

// Kategorie-Farb-Overlay (§1.3): unten Kategorie-Farbe (base→dark), oben transparent
// (Foto-Platzhalter-Streifen scheint durch). Fallback = Neutralton (getCategoryColor).
function catOverlay(name) {
  const { base, dark } = getCategoryColor(name)
  return `linear-gradient(to top, ${dark} 0%, ${base} 42%, color-mix(in srgb, ${base} 26%, transparent) 66%, transparent 86%)`
}

// Saison aus aktuellem Monat (editorial, dekorativ). Deep-Link „Saison→Rezepte"
// braucht den (noch fehlenden) Saison-Filter → vorerst Tap auf /recipes, kein Fake.
const SEASONS = {
  fruehling: { name: 'Frühling', color: 'var(--green)', phrase: 'Frisches Grün & erste Ernte' },
  sommer: { name: 'Sommer', color: 'var(--gold)', phrase: 'Leichtes für warme Tage' },
  herbst: { name: 'Herbst', color: 'var(--accent)', phrase: 'Kürbis, Pilze & Deftiges' },
  winter: { name: 'Winter', color: 'var(--blue)', phrase: 'Wärmendes & Eingemachtes' },
}
function currentSeason() {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'fruehling'
  if (m >= 6 && m <= 8) return 'sommer'
  if (m >= 9 && m <= 11) return 'herbst'
  return 'winter'
}

function CategoryTile({ cat, navigate }) {
  return (
    <button
      onClick={() => navigate(`/recipes?category=${cat.id}`)}
      data-track-id="categories-tile-click"
      style={{ position: 'relative', height: 96, borderRadius: 6, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 6px rgba(0,0,0,.1), 0 4px 0 0 var(--wood-shadow)' }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, var(--bg-alt) 0 8px, var(--wood-shadow) 8px 16px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: catOverlay(cat.name) }} />
      <div style={{ position: 'absolute', left: 11, right: 11, bottom: 9 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 16, lineHeight: 1.05, color: 'var(--on-accent)', textShadow: '0 1px 3px rgba(0,0,0,.45)' }}>{cat.name}</p>
        <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 9, color: 'rgba(255,255,255,.92)' }}>
          {cat.recipe_count} Rezept{cat.recipe_count === 1 ? '' : 'e'}
        </p>
      </div>
    </button>
  )
}

export default function Categories() {
  const navigate = useNavigate()
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Kategorien – PiEngines Recipes'
    client.get('/api/categories')
      .then(({ data }) => setCats(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const total = cats.reduce((s, c) => s + (c.recipe_count || 0), 0)
  const season = SEASONS[currentSeason()]

  // Kategorien nach §1.3-Gruppen bündeln (unbekannt → „Weitere").
  const byGroup = {}
  cats.forEach(c => { (byGroup[getCategoryGroup(c.name)] ||= []).push(c) })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton fallback="/" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Kategorien
        </h1>
        {total > 0 && (
          <p style={{ margin: '3px 0 20px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.04em', color: 'var(--text-muted)' }}>{total} Rezepte</p>
        )}

        {/* Saison-Highlight-Banner (editorial, dekorativ) */}
        {!loading && (
          <button
            onClick={() => navigate('/recipes')}
            data-track-id="categories-season-banner-click"
            style={{ position: 'relative', width: '100%', height: 96, borderRadius: 6, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.12), 0 4px 0 0 var(--nav-top-shadow)', background: `linear-gradient(135deg, ${season.color}, color-mix(in srgb, ${season.color} 55%, #000))` }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(20,14,6,.85) 0%, rgba(20,14,6,.5) 48%, rgba(20,14,6,.12) 100%)' }} />
            <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>✦ Jetzt in Saison</p>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 22, lineHeight: 1, color: 'var(--on-accent)', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>{season.name}küche</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 9, color: 'rgba(255,255,255,.8)' }}>{season.phrase}</p>
            </div>
            <i className="ti ti-chevron-right" style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,.7)' }} />
          </button>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 11 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 96, borderRadius: 6 }} />
            ))}
          </div>
        ) : cats.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Noch keine Kategorien vorhanden.</p>
        ) : (
          <>
            {CATEGORY_GROUP_ORDER.map(g => {
              const items = byGroup[g.key]
              if (!items || items.length === 0) return null
              return (
                <div key={g.key} style={{ marginBottom: 22 }}>
                  <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{g.label}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 11 }}>
                    {items.map(c => <CategoryTile key={c.id} cat={c} navigate={navigate} />)}
                  </div>
                </div>
              )
            })}
            {/* Hinweiszeile: Quer-Filter ≠ Kategorien (§04 Copy) */}
            <p style={{ margin: '4px 2px 0', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
              Vegetarisch, Vegan &amp; Schnell findest du als Filter in der Suche.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
