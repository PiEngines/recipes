// 07 · Kräuterschule — Übersicht (SPEC §07, screens/kraeuterschule.html)
// Grüne Farbwelt. Foto-Flächen sind durchgängig Platzhalter (keine echten Assets).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPlantCalendar, getPlants, getSpotlight } from '../api/plants'
import { getCategoryColor } from '../theme/categoryColors'
import { SAAT_ACTIVITIES } from '../theme/plantCalendar'
import {
  MONTH_NAMES,
  PLANT_CATEGORY_ORDER,
  plantImageStyle,
  shortBotanical,
} from '../theme/plants'

// ── Pflanzen-Kachel ──────────────────────────────────────────────────────────

function PlantTile({ plant }) {
  const { base } = getCategoryColor(plant.hauptkategorie)
  return (
    <Link
      to={`/pflanzen/${plant.slug}`}
      data-track-id="kraeuterschule-plant-tile-click"
      style={{
        flex: 'none', width: 104, background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        boxShadow: '0 2px 0 var(--wood-shadow), 0 1px 4px rgba(0,0,0,.06)',
        overflow: 'hidden', textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{ position: 'relative', height: 66, ...plantImageStyle }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 6, left: 7, width: 9, height: 9, borderRadius: '50%',
            background: base, boxShadow: '0 0 0 1.5px var(--surface)',
          }}
        />
      </div>
      <div style={{ padding: '7px 8px 9px' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, lineHeight: 1.15, color: 'var(--text)' }}>
          {plant.deutscher_name}
        </p>
        {plant.botanischer_name && (
          <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontStyle: 'italic', fontSize: 9, color: 'var(--text-muted)' }}>
            {shortBotanical(plant.botanischer_name)}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── „Jetzt im <Monat>" ───────────────────────────────────────────────────────

function SeasonChipRow({ label, color, tint, items }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
      <span style={{ flexShrink: 0, width: 48, paddingTop: 4, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, color }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map(p => (
          <Link
            key={p.pflanze_slug}
            to={`/pflanzen/${p.pflanze_slug}`}
            data-track-id="kraeuterschule-season-chip-click"
            style={{
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11,
              color, background: tint, padding: '4px 9px',
              borderRadius: 'var(--radius-tag)', textDecoration: 'none',
            }}
          >
            {p.pflanze_name}
          </Link>
        ))}
      </div>
    </div>
  )
}

function MonthModule({ monat, saeen, ernten, loading }) {
  return (
    <section
      id="kraeuterschule-monat"
      aria-label={`Jetzt im ${MONTH_NAMES[monat - 1]}`}
      style={{
        margin: '0 0 18px', background: 'var(--bg-alt)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-card)', padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          ◷ Jetzt im {MONTH_NAMES[monat - 1]}
        </span>
        <Link
          to="/garten"
          data-track-id="kraeuterschule-kalender-link"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Kalender →
        </Link>
      </div>
      {loading ? (
        <div className="skeleton-block" style={{ height: 46, borderRadius: 'var(--radius-tag)' }} />
      ) : saeen.length === 0 && ernten.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
          Für diesen Monat sind keine Aussaat- oder Erntetermine hinterlegt.
        </p>
      ) : (
        <>
          <SeasonChipRow
            label="Säen"
            color="var(--blue)"
            tint="color-mix(in srgb, var(--blue) 14%, transparent)"
            items={saeen}
          />
          <SeasonChipRow
            label="Ernten"
            color="var(--gold)"
            tint="color-mix(in srgb, var(--gold) 16%, transparent)"
            items={ernten}
          />
        </>
      )}
    </section>
  )
}

// ── Kraut des Monats ─────────────────────────────────────────────────────────

function SpotlightHero({ spotlight, monat }) {
  if (!spotlight) return null
  return (
    <Link
      to={`/pflanzen/${spotlight.slug}`}
      data-track-id="kraeuterschule-spotlight-click"
      style={{
        display: 'block', position: 'relative', height: 130, margin: '0 0 16px',
        borderRadius: 'var(--radius-card)', overflow: 'hidden', textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,.12), 0 4px 0 0 var(--nav-top-shadow)',
        ...plantImageStyle,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,20,10,.9) 0%, rgba(16,20,10,.5) 42%, rgba(16,20,10,.12) 68%, transparent 84%)' }} />
      <div style={{ position: 'absolute', left: 15, right: 15, bottom: 11 }}>
        <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
          ✦ Kraut des Monats · {MONTH_NAMES[monat - 1]}
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 24, lineHeight: 1, color: 'var(--on-accent)', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
          {spotlight.deutscher_name}
        </p>
        {spotlight.teaser && (
          <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,.85)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {spotlight.teaser}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function Kraeuterschule() {
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const [plants, setPlants] = useState([])
  const [spotlight, setSpotlight] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const monat = new Date().getMonth() + 1

  useEffect(() => {
    document.title = 'Kräuterschule – PiEngines Recipes'
    const controller = new AbortController()
    const opts = { signal: controller.signal }

    getPlants(opts)
      .then(data => setPlants(Array.isArray(data) ? data : []))
      .catch(err => { if (err.name !== 'CanceledError') setError(true) })
      .finally(() => setLoading(false))

    // Spotlight und Kalender sind Beiwerk — Fehler dort darf die Liste nicht kippen.
    getSpotlight(opts).then(setSpotlight).catch(() => {})
    getPlantCalendar(monat, opts)
      .then(setCalendar)
      .catch(() => {})
      .finally(() => setCalendarLoading(false))

    return () => controller.abort()
  }, [monat])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  const trimmed = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!trimmed) return plants
    return plants.filter(p =>
      p.deutscher_name?.toLowerCase().includes(trimmed) ||
      p.botanischer_name?.toLowerCase().includes(trimmed) ||
      p.hauptkategorie?.toLowerCase().includes(trimmed),
    )
  }, [plants, trimmed])

  // Nach hauptkategorie gruppieren; SPEC-Reihenfolge zuerst, Unbekanntes hinten.
  const groups = useMemo(() => {
    const byCat = new Map()
    for (const p of filtered) {
      const key = p.hauptkategorie || 'Weitere'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key).push(p)
    }
    const known = PLANT_CATEGORY_ORDER.filter(c => byCat.has(c))
    const rest = [...byCat.keys()].filter(c => !PLANT_CATEGORY_ORDER.includes(c)).sort()
    return [...known, ...rest].map(cat => [cat, byCat.get(cat)])
  }, [filtered])

  const { saeen, ernten } = useMemo(() => {
    const eintraege = calendar?.eintraege || []
    const uniq = (list) => {
      const seen = new Set()
      return list.filter(e => !seen.has(e.pflanze_slug) && seen.add(e.pflanze_slug))
    }
    return {
      // „Säen" fasst Aussaat/Direktsaat/Vorkultur zusammen, „Ernten" kommt aus Nutzung.
      saeen: uniq(eintraege.filter(e => SAAT_ACTIVITIES.includes(e.aktivitaet))).slice(0, 8),
      ernten: uniq(eintraege.filter(e => e.aktivitaet === 'Ernte')).slice(0, 8),
    }
  }, [calendar])

  return (
    <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>

        {/* Kopfzeile */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              ✦ PiEngines
            </p>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(24px, 4vw, 32px)', lineHeight: 1, color: 'var(--text)' }}>
              Kräuterschule
            </h1>
          </div>
          <button
            onClick={() => setSearchOpen(o => !o)}
            data-track-id="kraeuterschule-search-toggle"
            aria-label="Pflanze suchen"
            aria-expanded={searchOpen}
            style={{
              flexShrink: 0, background: 'var(--bg-alt)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius-input)', padding: '8px 11px', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            }}
          >
            <i className={searchOpen ? 'ti ti-x' : 'ti ti-search'} style={{ fontSize: 15 }} />
          </button>
        </div>

        {/* Suchbar — Client-Filter über die volle Liste */}
        {searchOpen && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1.5px solid var(--wood-shadow)', borderRadius: 'var(--radius-input)', padding: '9px 12px' }}>
            <i className="ti ti-search" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              data-track-id="kraeuterschule-search-input"
              placeholder="Pflanze suchen — Kräuter, Gemüse, Obst…"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                data-track-id="kraeuterschule-search-clear"
                aria-label="Suche leeren"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
              >
                <i className="ti ti-x" style={{ fontSize: 13 }} />
              </button>
            )}
          </div>
        )}

        {/* Kraut des Monats + Monatsmodul — bei aktiver Suche ausgeblendet */}
        {!trimmed && (
          <>
            <SpotlightHero spotlight={spotlight} monat={monat} />
            <MonthModule monat={monat} saeen={saeen} ernten={ernten} loading={calendarLoading} />
          </>
        )}

        {/* Kategorie-Reihen */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton-block" style={{ height: 12, width: 120, borderRadius: 'var(--radius-tag)', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="skeleton-block" style={{ flex: 'none', width: 104, height: 112, borderRadius: 'var(--radius-card)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Die Pflanzen konnten nicht geladen werden. Bitte lade die Seite neu.
          </p>
        ) : groups.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            {trimmed ? `Keine Pflanze gefunden für „${query.trim()}".` : 'Noch keine Pflanzen vorhanden.'}
          </p>
        ) : (
          groups.map(([cat, items]) => (
            <section key={cat} aria-label={cat} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: getCategoryColor(cat).base, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{cat}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{items.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                {items.map(p => <PlantTile key={p.slug} plant={p} />)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
