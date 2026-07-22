// 12 · Mein Beet — Garten-Hub (SPEC §12, screens/mein-beet.html)
// Grüne Farbwelt, Foto-Flächen sind Platzhalter.
// Bewusste Abweichung vom Prototyp (Lead-entschieden): kein Standort, keine
// Anzahl — `user_plants` bleibt minimal (Pflanze + planted_on), die Liste ist
// flach statt nach Standort gruppiert. Licht/Sonne steht im Pflanzen-Steckbrief.

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getGardenTasks } from '../api/plants'
import AddPlantSheet from '../components/AddPlantSheet'
import { useBeet } from '../context/BeetContext'
import { phaseBadge, plantedLabel, primaryTaskFor, taskLabel } from '../theme/gardenTasks'
import { plantImageStyle } from '../theme/plants'
import GartenKalender from './GartenKalender'

const SEGMENTS = [
  { key: 'beet', label: 'BEET' },
  { key: 'kalender', label: 'KALENDER' },
]

// ── Beet-Zeile ───────────────────────────────────────────────────────────────

// Ab hier gilt die Geste als horizontal und die Zeile folgt dem Finger; bis
// dahin darf die Liste ganz normal vertikal scrollen.
const RICHTUNGS_SCHWELLE = 10
// Ab hier löst das Loslassen das Löschen aus, darunter schnappt die Zeile zurück.
const LOESCH_SCHWELLE = 110

function BeetRow({ entry, task, onDelete }) {
  const badge = phaseBadge(entry.phase_badge)
  const hinweis = taskLabel(task)
  const meta = [plantedLabel(entry.planted_on), hinweis].filter(Boolean).join(' · ')

  const [dx, setDx] = useState(0)
  const [ziehend, setZiehend] = useState(false)
  const [hover, setHover] = useState(false)
  // Kein State: der Pointer-Handler muss den Stand im selben Tick sehen.
  const gesteRef = useRef(null)   // { startX, startY, achse: null|'x'|'y' }
  const gewischtRef = useRef(false)

  const ausschlag = Math.min(Math.abs(dx) / LOESCH_SCHWELLE, 1)
  const ueberSchwelle = Math.abs(dx) >= LOESCH_SCHWELLE

  const down = (e) => {
    // Nur der primäre Zeiger; Maus-Rechtsklick und Multitouch bleiben außen vor.
    if (e.button != null && e.button !== 0) return
    gesteRef.current = { startX: e.clientX, startY: e.clientY, achse: null }
    gewischtRef.current = false
  }

  const move = (e) => {
    const g = gesteRef.current
    if (!g) return
    const dxRoh = e.clientX - g.startX
    const dyRoh = e.clientY - g.startY

    // Richtungs-Lock: erst wenn klar ist, wohin die Geste geht, wird sie
    // beansprucht. Sonst bliebe die Liste beim Scrollen kleben.
    if (!g.achse) {
      if (Math.max(Math.abs(dxRoh), Math.abs(dyRoh)) < RICHTUNGS_SCHWELLE) return
      g.achse = Math.abs(dxRoh) > Math.abs(dyRoh) ? 'x' : 'y'
      if (g.achse === 'x') {
        setZiehend(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
    }
    if (g.achse !== 'x') return

    gewischtRef.current = true
    setDx(dxRoh)
  }

  const up = () => {
    const g = gesteRef.current
    gesteRef.current = null
    setZiehend(false)
    if (!g || g.achse !== 'x') return
    if (Math.abs(dx) >= LOESCH_SCHWELLE) onDelete(entry)
    setDx(0)
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}
    >
      {/* Hintergrund: färbt sich mit dem Ausschlag zunehmend rot und zeigt auf
          der Seite, aus der gewischt wird, Papierkorb + Beschriftung. Liegt
          immer da — in Ruhe verdeckt ihn die Zeile vollständig, und beim
          Zurückschnappen flackert so nichts. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: dx > 0 ? 'flex-start' : 'flex-end',
          padding: '0 18px', gap: 8,
          background: `color-mix(in srgb, var(--danger) ${Math.round(ausschlag * 100)}%, var(--bg-alt))`,
          color: ausschlag > 0.5 ? 'var(--on-accent)' : 'var(--danger)',
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10, letterSpacing: '.08em',
        }}
      >
        <i className="ti ti-trash" style={{ fontSize: 17 }} />
        {ueberSchwelle ? 'LOSLASSEN' : 'LÖSCHEN'}
      </div>

      <Link
        to={`/pflanzen/${entry.plant_slug}`}
        data-track-id="beet-plant-row-click"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // Nach einem Wisch darf der Loslass-Klick nicht auch noch navigieren.
        onClick={e => { if (gewischtRef.current) { e.preventDefault(); gewischtRef.current = false } }}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 12, padding: 10,
          background: 'var(--surface)', borderRadius: 'var(--radius-card)',
          boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)',
          textDecoration: 'none', color: 'inherit',
          transform: `translateX(${dx}px)`,
          transition: ziehend ? 'none' : 'transform .18s ease',
          // Vertikales Scrollen bleibt dem Browser, horizontales nehmen wir.
          touchAction: 'pan-y',
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

      {/* Zeigergeräte können nicht wischen — dort erscheint beim Überfahren ein
          Löschen-Knopf mit derselben Logik. */}
      {hover && !ziehend && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(entry) }}
          title={`„${entry.deutscher_name}" aus dem Beet entfernen`}
          aria-label={`„${entry.deutscher_name}" aus dem Beet entfernen`}
          data-track-id="beet-row-delete"
          className="hidden sm:flex"
          style={{
            position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
            width: 30, height: 30, borderRadius: 'var(--radius-pill)',
            border: 'none', cursor: 'pointer',
            background: 'var(--danger-tint)', color: 'var(--danger)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <i className="ti ti-trash" style={{ fontSize: 15 }} />
        </button>
      )}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyBeet({ onAdd }) {
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
      <button
        onClick={onAdd}
        data-track-id="beet-empty-add-click"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 20px',
          borderRadius: 'var(--radius-input)', background: 'var(--accent)', color: 'var(--on-accent)',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
          boxShadow: 'var(--btn-edge)',
        }}
      >
        <i className="ti ti-plus" style={{ fontSize: 15 }} /> Erste Pflanze hinzufügen
      </button>
    </div>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function Garten() {
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
  // Das Beet kommt aus dem Context — damit teilen es sich diese Seite, die
  // Quick-Add-Badges in der Kräuterschule und der Kalender-Filter.
  const { beet, loading: beetLoading, refresh: beetRefresh, entfernen, hinzufuegen } = useBeet()
  const [tasks, setTasks] = useState([])
  // Zuletzt entfernte Pflanze — trägt den Undo-Toast.
  const [entfernt, setEntfernt] = useState(null)
  const [tasksLoading, setTasksLoading] = useState(true)
  // Pflanzen kommen seit BUG-46 im Sheet dazu, nicht mehr über einen Absprung
  // in die Kräuterschule.
  const [addOffen, setAddOffen] = useState(false)

  useEffect(() => {
    document.title = 'Mein Beet – PiEngines Recipes'
    const controller = new AbortController()
    // Aufgaben sind Beiwerk der Liste — ein Fehler hier darf das Beet nicht kippen.
    getGardenTasks({ signal: controller.signal })
      .then(d => setTasks(d?.tasks || []))
      .catch(() => {})
      .finally(() => setTasksLoading(false))
    return () => controller.abort()
  }, [])

  const loading = beetLoading || tasksLoading

  const loeschen = (eintrag) => {
    setEntfernt(eintrag)
    entfernen(eintrag.plant_slug)
  }

  const rueckgaengig = () => {
    if (!entfernt) return
    hinzufuegen(entfernt.plant_slug, entfernt.deutscher_name)
    setEntfernt(null)
  }

  // Der Toast blendet sich per CSS aus; hier wird er nur aus dem Baum genommen,
  // damit „Rückgängig" nicht unsichtbar weiterklickbar bleibt.
  useEffect(() => {
    if (!entfernt) return undefined
    const t = setTimeout(() => setEntfernt(null), 6000)
    return () => clearTimeout(t)
  }, [entfernt])

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
          ) : beet.length === 0 ? (
            <EmptyBeet onAdd={() => setAddOffen(true)} />
          ) : (
            <>
              <section id="beet-liste" aria-label="Pflanzen im Beet" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {beet.map(entry => (
                  <BeetRow
                    key={entry.user_plant_id}
                    entry={entry}
                    task={primaryTaskFor(tasks, entry.user_plant_id)}
                    onDelete={loeschen}
                  />
                ))}
              </section>
              <button
                onClick={() => setAddOffen(true)}
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
            beet={beet}
            tasks={tasks}
            tasksLoading={tasksLoading}
            onTasksChange={setTasks}
          />
        )}
      </div>

      {addOffen && (
        <AddPlantSheet onClose={() => setAddOffen(false)} onAdded={beetRefresh} />
      )}

      {/* Undo-Toast — anders als `.toast-auto` anklickbar und mit 6 s länger
          stehend, sonst wäre „Rückgängig" nicht erreichbar. */}
      {entfernt && (
        <div
          role="status"
          className="toast-undo"
          style={{
            position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, maxWidth: 'calc(100% - 32px)',
            background: 'rgba(44,44,42,.94)', color: '#fff', borderRadius: 8,
            padding: '10px 12px 10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'var(--font-body)', fontSize: '0.85rem',
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            „{entfernt.deutscher_name}" entfernt
          </span>
          <button
            onClick={rueckgaengig}
            data-track-id="beet-delete-undo"
            style={{
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gold-bright, #E8C56A)', fontFamily: 'var(--font-body)',
              fontSize: '0.85rem', fontWeight: 700, padding: '2px 4px',
            }}
          >
            Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
