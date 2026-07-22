// 08 · Pflanzen-Detail (SPEC §08, screens/pflanzendetail.html)
// Konstanter Foto-Hero über alle Tabs, grüne Farbwelt.
// Bewusst NICHT enthalten (dokumentierte Abweichung → Merkliste):
// Probleme-Tab, Sorten-Sektion, Teilen-Button im Hero.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPhases, getPlant, getPlantRecipes } from '../api/plants'
import BackButton from '../components/BackButton'
import { useBeet } from '../context/BeetContext'
import { getCategoryColor } from '../theme/categoryColors'
import { buildPhaseMap, monthsForEntry, TIMELINE_ROWS } from '../theme/plantCalendar'
import { shelfForHauptkategorie } from '../theme/plantShelves'
import { LOREM_BESCHREIBUNG, MONTH_NAMES, plantHeroImageStyle, plantImageStyle } from '../theme/plants'

const TABS = [
  { key: 'steckbrief', label: 'STECKBRIEF' },
  { key: 'anbau', label: 'ANBAU' },
  { key: 'rezepte', label: 'REZEPTE' },
]

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const HINT_ICONS = {
  Aussaat: { icon: 'ti-seeding', color: 'var(--blue)' },
  Direktsaat: { icon: 'ti-seeding', color: 'var(--blue)' },
  Vorkultur: { icon: 'ti-seeding', color: 'var(--blue)' },
  Pflanzung: { icon: 'ti-plant-2', color: 'var(--green)' },
  Ernte: { icon: 'ti-basket', color: 'var(--gold)' },
}

// ── Hero (konstant über alle Tabs) ───────────────────────────────────────────

function PlantHero({ plant }) {
  return (
    <div style={{ position: 'relative', height: 180, borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 0, ...plantHeroImageStyle }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,20,10,.88) 0%, rgba(16,20,10,.45) 45%, rgba(16,20,10,.1) 72%, transparent 88%)' }} />
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 13 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 26, lineHeight: 1, color: 'var(--on-accent)', textShadow: '0 1px 5px rgba(0,0,0,.45)' }}>
          {plant.deutscher_name}
        </h1>
        {plant.botanischer_name && (
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontStyle: 'italic', fontSize: 11, color: 'rgba(255,255,255,.72)' }}>
            {plant.botanischer_name}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Giftwarnung (sicherheitskritisch, prominent) ─────────────────────────────

function ToxicityWarning({ plant }) {
  const nichtEssbar = plant.essbarkeit && plant.essbarkeit !== 'essbar'
  if (!nichtEssbar && !plant.warnung && !plant.giftige_teile) return null

  const LABELS = {
    'essbar-mit-einschränkung': 'Essbar — mit Einschränkung',
    'nur-verarbeitet': 'Nur verarbeitet essbar',
    'teilweise-giftig': 'Teilweise giftig',
  }

  return (
    <section
      id="pflanze-warnung"
      aria-label="Sicherheitshinweis"
      role="alert"
      style={{
        marginBottom: 14, background: 'var(--danger-tint)',
        border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-card)',
        padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start',
      }}
    >
      <i className="ti ti-alert-triangle-filled" aria-hidden="true" style={{ fontSize: 20, color: 'var(--danger)', flexShrink: 0, lineHeight: 1 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--danger)' }}>
          {LABELS[plant.essbarkeit] || 'Achtung'}
        </p>
        {plant.warnung && (
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
            {plant.warnung}
          </p>
        )}
        {plant.giftige_teile && (
          <p style={{ margin: plant.warnung ? '6px 0 0' : 0, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
            <strong style={{ fontWeight: 600 }}>Giftige Teile:</strong> {plant.giftige_teile}
          </p>
        )}
      </div>
    </section>
  )
}

// ── Steckbrief ───────────────────────────────────────────────────────────────

function FactCard({ label, value }) {
  if (!value) return null
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '10px 12px', boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)' }}>
      <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function RelationChips({ items, color, tint }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((r, i) => {
        const inner = (
          <>
            {r.ziel_name}
            {r.qualifier && <span style={{ opacity: 0.7 }}> · {r.qualifier}</span>}
          </>
        )
        const style = {
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11,
          color, background: tint, padding: '4px 9px',
          borderRadius: 'var(--radius-tag)', textDecoration: 'none',
        }
        return r.ziel_slug ? (
          <Link key={`${r.ziel_name}-${i}`} to={`/pflanzen/${r.ziel_slug}`} data-track-id="pflanze-mischkultur-chip-click" style={style}>
            {inner}
          </Link>
        ) : (
          <span key={`${r.ziel_name}-${i}`} style={style}>{inner}</span>
        )
      })}
    </div>
  )
}

function SteckbriefTab({ plant, inBeet, beetBusy, onToggleBeet }) {
  // Chip-Farbe = Farbe des Regals, in das die hauptkategorie fällt
  // (die DB-Werte selbst stehen nicht in CATEGORY_COLORS).
  const catColor = getCategoryColor(shelfForHauptkategorie(plant.hauptkategorie))
  const chips = [
    plant.hauptkategorie && { text: plant.hauptkategorie, color: catColor.base },
    plant.lebensdauer && { text: plant.lebensdauer, color: 'var(--green)' },
    plant.anbau_typ && { text: plant.anbau_typ, color: 'var(--green)' },
  ].filter(Boolean)

  const gut = plant.relationen?.mischkultur_gut || []
  const schlecht = plant.relationen?.mischkultur_schlecht || []

  return (
    <>
      <ToxicityWarning plant={plant} />

      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10,
                letterSpacing: '.06em', padding: '4px 9px', borderRadius: 'var(--radius-tag)',
                color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
              }}
            >
              {c.text}
            </span>
          ))}
        </div>
      )}

      <section id="pflanze-steckbrief" aria-label="Steckbrief" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <FactCard label="Familie" value={plant.botanische_familie} />
        <FactCard label="Höhe" value={plant.hoehe} />
        <FactCard label="Standort" value={plant.licht} />
        <FactCard label="Wasser" value={plant.wasserbedarf} />
        <FactCard label="Boden" value={plant.bodenanspruch} />
        <FactCard label="Nährstoffe" value={plant.naehrstoffbedarf} />
      </section>

      <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}>
        {plant.beschreibungstext?.trim() || LOREM_BESCHREIBUNG}
      </p>

      {(gut.length > 0 || schlecht.length > 0) && (
        <section id="pflanze-mischkultur" aria-label="Mischkultur" style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 9px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Mischkultur
          </p>
          {gut.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 5px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Gute Nachbarn</p>
              <RelationChips items={gut} color="var(--green)" tint="color-mix(in srgb, var(--green) 14%, transparent)" />
            </div>
          )}
          {schlecht.length > 0 && (
            <div>
              <p style={{ margin: '0 0 5px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>Meiden</p>
              <RelationChips items={schlecht} color="var(--danger)" tint="var(--danger-tint)" />
            </div>
          )}
        </section>
      )}

      <button
        onClick={onToggleBeet}
        disabled={beetBusy}
        data-track-id={inBeet ? 'pflanze-beet-remove' : 'pflanze-beet-add'}
        style={{
          width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-input)',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
          cursor: beetBusy ? 'default' : 'pointer', opacity: beetBusy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: inBeet ? '1.5px solid var(--green)' : 'none',
          background: inBeet ? 'transparent' : 'var(--accent)',
          color: inBeet ? 'var(--green)' : 'var(--on-accent)',
          boxShadow: inBeet ? 'none' : 'var(--btn-edge)',
        }}
      >
        <i className={inBeet ? 'ti ti-check' : 'ti ti-plus'} style={{ fontSize: 16 }} />
        {inBeet ? 'Im Beet — entfernen' : 'In mein Beet'}
      </button>
    </>
  )
}

// ── Anbau ────────────────────────────────────────────────────────────────────

function Timeline({ kalender, phaseMap, monat }) {
  const rows = TIMELINE_ROWS.map(row => {
    const entries = (kalender?.[row.group] || []).filter(e => row.activities.includes(e.aktivitaet))
    const months = new Set()
    entries.forEach(e => monthsForEntry(e, phaseMap).forEach(m => months.add(m)))
    return { ...row, months }
  })

  if (rows.every(r => r.months.size === 0)) return null

  return (
    <section id="pflanze-timeline" aria-label="Anbau-Kalender" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '12px 14px', marginBottom: 16, boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Anbau-Kalender
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9, letterSpacing: '.05em', color: 'var(--accent)' }}>
          ▼ {MONTH_NAMES[monat - 1]}
        </span>
      </div>

      {/* Marker aktueller Monat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, marginBottom: 3, marginLeft: 52 }}>
        {MONTH_LETTERS.map((_, i) => (
          <div key={i} style={{ height: 5, display: 'flex', justifyContent: 'center' }}>
            {i + 1 === monat && <div style={{ width: 2, background: 'var(--accent)' }} />}
          </div>
        ))}
      </div>

      {/* Monatsraster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, marginBottom: 8, marginLeft: 52 }}>
        {MONTH_LETTERS.map((l, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 8, color: i + 1 === monat ? 'var(--accent)' : 'var(--text-muted)' }}>
            {l}
          </div>
        ))}
      </div>

      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ width: 46, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: row.months.size ? row.color : 'var(--text-muted)' }}>
            {row.label}
          </span>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
            {MONTH_LETTERS.map((_, i) => {
              const on = row.months.has(i + 1)
              return (
                <div
                  key={i}
                  style={{
                    height: 11, borderRadius: 2,
                    background: on ? row.color : `color-mix(in srgb, ${row.color} 12%, transparent)`,
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

function AnbauTab({ plant, kalender, phaseMap, monat, beetEntry }) {
  const hinweise = [
    ...(kalender?.anbau || []),
    ...(kalender?.nutzung || []),
    ...(kalender?.pflege || []),
  ].filter(e => e.hinweis)

  return (
    <>
      {beetEntry && (
        <section
          id="pflanze-beet-streifen"
          aria-label="In deinem Beet"
          style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: 'var(--radius-card)', padding: '11px 13px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <i className="ti ti-plant-2" aria-hidden="true" style={{ fontSize: 18, color: 'var(--green)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              In deinem Beet
            </p>
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              gepflanzt {new Date(beetEntry.planted_on).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link
            to="/garten?tab=kalender"
            data-track-id="pflanze-beet-kalender-link"
            style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', textDecoration: 'none' }}
          >
            Kalender →
          </Link>
        </section>
      )}

      <Timeline kalender={kalender} phaseMap={phaseMap} monat={monat} />

      {hinweise.length > 0 && (
        <section id="pflanze-anbauhinweise" aria-label="Anbauhinweise">
          <p style={{ margin: '0 0 9px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Anbauhinweise
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hinweise.map((e, i) => {
              const meta = HINT_ICONS[e.aktivitaet] || { icon: 'ti-leaf', color: 'var(--text-muted)' }
              const span = [e.phase_von_name, e.phase_bis_name]
                .filter(Boolean)
                .filter((v, idx, arr) => arr.indexOf(v) === idx)
                .join(' – ')
              return (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '11px 13px', boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)', display: 'flex', gap: 10 }}>
                  <i className={`ti ${meta.icon}`} aria-hidden="true" style={{ fontSize: 16, color: meta.color, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                      {e.aktivitaet}
                      {span && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 10, color: 'var(--text-muted)' }}> · {span}</span>}
                    </p>
                    <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                      {e.hinweis}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {hinweise.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Für diese Pflanze sind noch keine Anbauhinweise hinterlegt.
        </p>
      )}
    </>
  )
}

// ── Rezepte ──────────────────────────────────────────────────────────────────

function RezepteTab({ plant, recipes, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 64, borderRadius: 'var(--radius-card)' }} />
        ))}
      </div>
    )
  }

  if (recipes.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
        Noch keine Rezepte mit {plant.deutscher_name}.
      </p>
    )
  }

  return (
    <section id="pflanze-rezepte" aria-label="Rezepte">
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {recipes.length} Rezept{recipes.length === 1 ? '' : 'e'} mit {plant.deutscher_name}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipes.map(r => (
          <Link
            key={r.id}
            to={`/recipes/${r.id}`}
            data-track-id="pflanze-rezept-zeile-click"
            style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 9, textDecoration: 'none', color: 'inherit', boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)' }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-tile)', flexShrink: 0, ...plantImageStyle }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </p>
              <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                {[r.type === 'backen' ? 'Backen' : 'Kochen', r.author_name].filter(Boolean).join(' · ')}
              </p>
            </div>
            <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function PflanzenDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [plant, setPlant] = useState(null)
  const [phases, setPhases] = useState([])
  // Das Beet kommt aus dem Context, damit diese Seite und die Quick-Add-Badges
  // denselben Stand teilen.
  const { beet, umschalten: beetUmschalten } = useBeet()
  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('steckbrief')
  const [beetBusy, setBeetBusy] = useState(false)
  const [beetError, setBeetError] = useState('')

  const monat = new Date().getMonth() + 1

  useEffect(() => {
    const controller = new AbortController()
    const opts = { signal: controller.signal }
    setLoading(true)
    setTab('steckbrief')

    getPlant(slug, opts)
      .then(data => {
        setPlant(data)
        document.title = `${data.deutscher_name} – Kräuterschule – PiEngines Recipes`
      })
      .catch(err => { if (err.name !== 'CanceledError') navigate('/kraeuterschule') })
      .finally(() => setLoading(false))

    getPhases(opts).then(setPhases).catch(() => {})
    getPlantRecipes(slug, opts)
      .then(data => setRecipes(data?.recipes || []))
      .catch(() => {})
      .finally(() => setRecipesLoading(false))

    return () => controller.abort()
  }, [slug, navigate])

  const phaseMap = useMemo(() => buildPhaseMap(phases), [phases])

  const beetEntry = beet.find(b => b.plant_slug === slug) || null
  const inBeet = !!beetEntry

  // Umschalten läuft über den Context — sonst wüsste das „+"-Badge auf den
  // Kacheln nichts davon (und umgekehrt).
  const toggleBeet = useCallback(async () => {
    if (!plant || beetBusy) return
    setBeetBusy(true)
    setBeetError('')
    try {
      await beetUmschalten(slug, plant.deutscher_name)
    } catch {
      setBeetError('Das hat nicht geklappt. Bitte versuch es noch einmal.')
    } finally {
      setBeetBusy(false)
    }
  }, [plant, beetBusy, slug, beetUmschalten])

  if (loading) {
    return (
      <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
          <div className="skeleton-block" style={{ height: 180, borderRadius: 'var(--radius-card)', marginBottom: 14 }} />
          <div className="skeleton-block" style={{ height: 38, borderRadius: 'var(--radius-card)', marginBottom: 14 }} />
          <div className="skeleton-block" style={{ height: 200, borderRadius: 'var(--radius-card)' }} />
        </div>
      </div>
    )
  }

  if (!plant) return null

  return (
    <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton fallback="/kraeuterschule" />
        </div>

        <PlantHero plant={plant} />

        {/* Tabs — aktiver Tab mit dunkler Unterlinie */}
        <div role="tablist" aria-label="Pflanzen-Ansichten" style={{ display: 'flex', background: 'var(--surface)', borderBottom: '2px solid var(--bg-alt)', marginBottom: 16 }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                data-track-id={`pflanze-tab-${t.key}`}
                style={{
                  flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.02em',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {beetError && (
          <p role="status" style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
            {beetError}
          </p>
        )}

        {tab === 'steckbrief' && (
          <SteckbriefTab plant={plant} inBeet={inBeet} beetBusy={beetBusy} onToggleBeet={toggleBeet} />
        )}
        {tab === 'anbau' && (
          <AnbauTab plant={plant} kalender={plant.kalender} phaseMap={phaseMap} monat={monat} beetEntry={beetEntry} />
        )}
        {tab === 'rezepte' && (
          <RezepteTab plant={plant} recipes={recipes} loading={recipesLoading} />
        )}
      </div>
    </div>
  )
}
