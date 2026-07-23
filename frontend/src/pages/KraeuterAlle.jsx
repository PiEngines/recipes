// 07b · Kräuterschule — alle Pflanzen (BUG-52)
//
// Die Übersicht sortiert Pflanzen in horizontale Regale; eine Pflanze steht
// dabei ggf. in zweien. Diese Seite ist das Gegenstück: **eine** Liste, alle
// Pflanzen untereinander, jede genau einmal.
//
// Die API liefert alle 279 auf einen Schlag (keine Server-Pagination), gerendert
// wird trotzdem in Häppchen — 279 Zeilen auf einmal in den Baum zu hängen kostet
// beim ersten Paint spürbar. Nachgeschoben wird über denselben Sentinel wie im
// Rezept-Grid (BUG-10).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { getPlants } from '../api/plants'
import BackButton from '../components/BackButton'
import BeetBadge from '../components/BeetBadge'
import { getCategoryColor } from '../theme/categoryColors'
import { plantImageStyle, shortBotanical } from '../theme/plants'
import { PLANT_SHELVES, shelfForHauptkategorie } from '../theme/plantShelves'

const CHUNK = 30

const SHELF_LABEL = Object.fromEntries(PLANT_SHELVES.map(s => [s.key, s.label]))

function PlantRow({ plant }) {
  // Ein Regal je Zeile — die Liste ist flach, die Mehrfachzuordnung der
  // Übersicht (Salbei: Küche + Heil) wäre hier nur verwirrend.
  const shelf = shelfForHauptkategorie(plant.hauptkategorie)
  const farbe = getCategoryColor(shelf).base

  return (
    <Link
      to={`/pflanzen/${plant.slug}`}
      data-track-id="kraeuter-alle-row-click"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 10,
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 'var(--radius-tile)', flexShrink: 0, ...plantImageStyle }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 5, left: 5, width: 8, height: 8, borderRadius: '50%',
            background: farbe, boxShadow: '0 0 0 1.5px var(--surface)',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plant.deutscher_name}
        </p>
        {plant.botanischer_name && (
          <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontStyle: 'italic', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortBotanical(plant.botanischer_name)}
          </p>
        )}
      </div>
      <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, letterSpacing: '.06em', color: farbe }}>
        {SHELF_LABEL[shelf] || ''}
      </span>
      {/* In der Zeile sitzt das Badge am rechten Rand statt im Bild — die
          52px-Fläche ist dafür zu klein. */}
      <BeetBadge slug={plant.slug} name={plant.deutscher_name} style={{ position: 'static' }} />
    </Link>
  )
}

export default function KraeuterAlle() {
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sichtbar, setSichtbar] = useState(CHUNK)
  const sentinelRef = useRef(null)

  // Suchbegriff wie in der Kräuterschule über `?q=` (BUG-49) — damit greift
  // auch die globale Leiste, wenn sie hierher zeigt.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const setQuery = (wert) => {
    // Neuer Begriff heißt neue Liste — das Fenster fängt wieder von vorn an.
    setSichtbar(CHUNK)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (wert) next.set('q', wert)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  useEffect(() => {
    document.title = 'Alle Pflanzen – PiEngines Recipes'
    const controller = new AbortController()
    getPlants({ signal: controller.signal })
      .then(daten => setPlants(Array.isArray(daten) ? daten : []))
      .catch(err => { if (err.name !== 'CanceledError') setError(true) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const gefiltert = useMemo(() => {
    const term = query.trim().toLowerCase()
    const liste = term
      ? plants.filter(p =>
        p.deutscher_name?.toLowerCase().includes(term) ||
        p.botanischer_name?.toLowerCase().includes(term) ||
        p.hauptkategorie?.toLowerCase().includes(term))
      : plants
    return [...liste].sort((a, b) =>
      (a.deutscher_name || '').localeCompare(b.deutscher_name || '', 'de'))
  }, [plants, query])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return undefined
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) setSichtbar(n => n + CHUNK)
      },
      { rootMargin: '300px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const angezeigt = gefiltert.slice(0, sichtbar)
  const nochMehr = sichtbar < gefiltert.length

  return (
    <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>

        <BackButton fallback="/kraeuterschule" floating style={{ marginBottom: 14 }} />

        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Kräuterschule
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 4vw, 30px)', lineHeight: 1, color: 'var(--text)' }}>
            Alle Pflanzen
          </h1>
          {!loading && (
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {gefiltert.length} Pflanze{gefiltert.length === 1 ? '' : 'n'}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1.5px solid var(--wood-shadow)', borderRadius: 'var(--radius-input)', padding: '9px 12px', marginBottom: 16 }}>
          <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            data-track-id="kraeuter-alle-search-input"
            placeholder="Pflanze suchen — Kräuter, Gemüse, Obst…"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              data-track-id="kraeuter-alle-search-clear"
              aria-label="Suche leeren"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
            >
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : error ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Die Pflanzen konnten nicht geladen werden. Bitte lade die Seite neu.
          </p>
        ) : gefiltert.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Keine Pflanze gefunden für „{query.trim()}".
          </p>
        ) : (
          <section id="kraeuter-alle-liste" aria-label="Alle Pflanzen" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {angezeigt.map(p => <PlantRow key={p.slug} plant={p} />)}
          </section>
        )}

        {nochMehr && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        )}

        {/* Sentinel — steht immer im Baum, damit der Observer ihn beim ersten
            Rendern findet. */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}
