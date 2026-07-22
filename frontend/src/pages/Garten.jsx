// 12 · Mein Beet — Garten-Hub (SPEC §12, screens/mein-beet.html)
// Grüne Farbwelt, Foto-Flächen sind Platzhalter.
// Bewusste Abweichung vom Prototyp (Lead-entschieden): kein Standort, keine
// Anzahl — `user_plants` bleibt minimal (Pflanze + planted_on), die Liste ist
// flach statt nach Standort gruppiert. Licht/Sonne steht im Pflanzen-Steckbrief.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getGardenTasks, getMyBeet } from '../api/plants'
import { phaseBadge, plantedLabel, primaryTaskFor, taskLabel } from '../theme/gardenTasks'
import { plantImageStyle } from '../theme/plants'
import GartenKalender from './GartenKalender'

const SEGMENTS = [
  { key: 'beet', label: 'BEET' },
  { key: 'kalender', label: 'KALENDER' },
]

// ── Beet-Zeile ───────────────────────────────────────────────────────────────

function BeetRow({ entry, task }) {
  const badge = phaseBadge(entry.phase_badge)
  const hinweis = taskLabel(task)
  const meta = [plantedLabel(entry.planted_on), hinweis].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/pflanzen/${entry.plant_slug}`}
      data-track-id="beet-plant-row-click"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 10,
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-tile)', flexShrink: 0, ...plantImageStyle }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
          {entry.deutscher_name}
        </p>
        {meta && (
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta}
          </p>
        )}
      </div>
      <span
        style={{
          flexShrink: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 9,
          letterSpacing: '.08em', padding: '3px 8px', borderRadius: 'var(--radius-tag)',
          color: badge.color, background: `color-mix(in srgb, ${badge.color} 14%, transparent)`,
        }}
      >
        {badge.label}
      </span>
    </Link>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyBeet() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <i className="ti ti-plant-2" aria-hidden="true" style={{ fontSize: 42, color: 'var(--text-muted)' }} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>
        Dein Beet ist noch leer
      </h2>
      <p style={{ margin: '0 0 20px', maxWidth: 320, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Füge deine Pflanzen hinzu — daraus leiten wir Säen, Pflegen und Ernten ab.
      </p>
      <Link
        to="/kraeuterschule"
        data-track-id="beet-empty-add-click"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 20px',
          borderRadius: 'var(--radius-input)', background: 'var(--accent)', color: 'var(--on-accent)',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
          textDecoration: 'none', boxShadow: 'var(--btn-edge)',
        }}
      >
        <i className="ti ti-plus" style={{ fontSize: 15 }} /> Erste Pflanze hinzufügen
      </Link>
    </div>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function Garten() {
  const navigate = useNavigate()
  // Das Segment steht in der URL, damit „Kalender →" von außen direkt dorthin
  // führt (BUG-51). Ohne Parameter bleibt es beim Beet.
  const [searchParams, setSearchParams] = useSearchParams()
  const segmentAusUrl = searchParams.get('tab')
  const segment = SEGMENTS.some(s => s.key === segmentAusUrl) ? segmentAusUrl : 'beet'
  const setSegment = (key) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (key === 'beet') next.delete('tab')
    else next.set('tab', key)
    return next
  }, { replace: true })
  const [beet, setBeet] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback((signal) => {
    const opts = signal ? { signal } : {}
    return Promise.all([
      getMyBeet(opts).then(d => setBeet(Array.isArray(d) ? d : [])),
      // Aufgaben sind Beiwerk der Liste — ein Fehler hier darf das Beet nicht kippen.
      getGardenTasks(opts).then(d => setTasks(d?.tasks || [])).catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    document.title = 'Mein Beet – PiEngines Recipes'
    const controller = new AbortController()
    load(controller.signal)
      .catch(err => { if (err.name !== 'CanceledError') setError(true) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [load])

  return (
    <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>

        {/* Kopf */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Mein Garten
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 4vw, 30px)', lineHeight: 1, color: 'var(--text)' }}>
            Mein Beet
          </h1>
          {!loading && beet.length > 0 && (
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {beet.length} Pflanze{beet.length === 1 ? '' : 'n'}
            </p>
          )}
        </div>

        {/* Segment-Umschalter */}
        <div
          role="tablist"
          aria-label="Ansicht"
          style={{ display: 'flex', gap: 2, background: 'var(--bg-alt)', borderRadius: 'var(--radius-tag)', padding: 2, marginBottom: 18 }}
        >
          {SEGMENTS.map(s => {
            const active = segment === s.key
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(s.key)}
                data-track-id={`beet-segment-${s.key}`}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-tag)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em',
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {segment === 'beet' && (
          loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 'var(--radius-card)' }} />
              ))}
            </div>
          ) : error ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
              Dein Beet konnte nicht geladen werden. Bitte lade die Seite neu.
            </p>
          ) : beet.length === 0 ? (
            <EmptyBeet />
          ) : (
            <>
              <section id="beet-liste" aria-label="Pflanzen im Beet" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {beet.map(entry => (
                  <BeetRow
                    key={entry.user_plant_id}
                    entry={entry}
                    task={primaryTaskFor(tasks, entry.user_plant_id)}
                  />
                ))}
              </section>
              <button
                onClick={() => navigate('/kraeuterschule')}
                data-track-id="beet-add-plant-click"
                style={{
                  width: '100%', marginTop: 14, padding: '12px 16px',
                  borderRadius: 'var(--radius-input)', cursor: 'pointer',
                  border: '1.5px dashed var(--wood-shadow)', background: 'transparent',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                  color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> PFLANZE HINZUFÜGEN
              </button>
            </>
          )
        )}

        {segment === 'kalender' && (
          <GartenKalender
            tasks={tasks}
            tasksLoading={loading}
            onTasksChange={setTasks}
          />
        )}
      </div>
    </div>
  )
}
