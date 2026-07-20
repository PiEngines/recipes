// 11 · Mein Beet · Segment KALENDER (SPEC §11, screens/kalender.html)
// Zwei Linsen: SAISON (was hat gerade Saison) · ARBEIT (was ist im Beet zu tun).
//
// Weggelassen (Lead-entschieden → Merkliste):
// - „Passend jetzt kochen" (Saison-Rezepte) — braucht Rezept↔Beet-Matching.
// - Wochen-Linse — die Kalenderdaten haben nur Monatsauflösung.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGardenTasks, getPlantCalendar, markTaskDone, unmarkTaskDone } from '../api/plants'
import { groupTasksByPlant, taskLabel, taskPhaseSpan } from '../theme/gardenTasks'
import { MONTH_NAMES } from '../theme/plants'

const LENSES = [
  { key: 'saison', label: 'SAISON' },
  { key: 'arbeit', label: 'ARBEIT' },
]

// ── Linse SAISON ─────────────────────────────────────────────────────────────

function SaisonLens({ monat, erntereif, loading }) {
  return (
    <section id="kalender-saison" aria-label={`Erntereif im ${MONTH_NAMES[monat - 1]}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Erntereif im {MONTH_NAMES[monat - 1]}
        </p>
        <Link
          to="/kraeuterschule"
          data-track-id="kalender-kraeuterschule-link"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Zur Kräuterschule →
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ width: 96, height: 28, borderRadius: 'var(--radius-tag)' }} />
          ))}
        </div>
      ) : erntereif.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Für diesen Monat sind keine Erntetermine hinterlegt.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {erntereif.map(p => (
              <Link
                key={p.pflanze_slug}
                to={`/pflanzen/${p.pflanze_slug}`}
                data-track-id="kalender-saison-chip-click"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
                  color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 16%, transparent)',
                  padding: '5px 10px', borderRadius: 'var(--radius-tag)', textDecoration: 'none',
                }}
              >
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                {p.pflanze_name}
              </Link>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            {erntereif.length} Pflanze{erntereif.length === 1 ? '' : 'n'} mit Erntezeit in diesem Monat
          </p>
        </>
      )}
    </section>
  )
}

// ── Linse ARBEIT ─────────────────────────────────────────────────────────────

function TaskRow({ task, busy, onToggle }) {
  const label = taskLabel(task)
  const span = taskPhaseSpan(task)

  // Laufende Tätigkeiten und Blühzeit-Vermerke sind Status — kein Haken.
  if (!task.actionable) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px', background: 'var(--bg-alt)', borderRadius: 'var(--radius-card)' }}>
        <i className="ti ti-info-circle" aria-hidden="true" style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
            {label}
          </p>
          {span && (
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              {span}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onToggle}
      disabled={busy}
      aria-pressed={task.done}
      data-track-id={task.done ? 'kalender-task-undone' : 'kalender-task-done'}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 11px', textAlign: 'left', cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1, border: 'none',
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        boxShadow: '0 1px 0 var(--wood-shadow), 0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 19, height: 19, flexShrink: 0, marginTop: 1, borderRadius: 4,
          border: task.done ? 'none' : '1.5px solid var(--border-input)',
          background: task.done ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--on-accent)' }} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
          color: task.done ? 'var(--text-muted)' : 'var(--text)',
          textDecoration: task.done ? 'line-through' : 'none',
        }}>
          {label}
        </span>
        {span && (
          <span style={{ display: 'block', margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            {span}
          </span>
        )}
      </span>
    </button>
  )
}

function ArbeitLens({ monat, groups, loading, busyKeys, onToggle, error }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 56, borderRadius: 'var(--radius-card)' }} />
        ))}
      </div>
    )
  }

  return (
    <section id="kalender-arbeit" aria-label={`Zu tun im ${MONTH_NAMES[monat - 1]}`}>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Zu tun im {MONTH_NAMES[monat - 1]}
      </p>

      {error && (
        <p role="status" style={{ margin: '0 0 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Diesen Monat steht für dein Beet nichts an.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(g => (
            <div key={g.user_plant_id}>
              <Link
                to={`/pflanzen/${g.plant_slug}`}
                data-track-id="kalender-task-plant-link"
                style={{ display: 'inline-block', marginBottom: 7, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}
              >
                {g.deutscher_name} <span style={{ color: 'var(--text-muted)' }}>›</span>
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.tasks.map(t => (
                  <TaskRow
                    key={t.task_key}
                    task={t}
                    busy={busyKeys.has(`${t.user_plant_id}:${t.task_key}`)}
                    onToggle={() => onToggle(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Segment ──────────────────────────────────────────────────────────────────

export default function GartenKalender({ tasks, tasksLoading, onTasksChange }) {
  const [lens, setLens] = useState('saison')
  const [calendar, setCalendar] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [busyKeys, setBusyKeys] = useState(new Set())
  const [error, setError] = useState('')

  const monat = new Date().getMonth() + 1

  useEffect(() => {
    const controller = new AbortController()
    getPlantCalendar(monat, { signal: controller.signal })
      .then(setCalendar)
      .catch(() => {})
      .finally(() => setCalendarLoading(false))
    return () => controller.abort()
  }, [monat])

  const erntereif = useMemo(() => {
    const seen = new Set()
    return (calendar?.eintraege || [])
      .filter(e => e.aktivitaet === 'Ernte')
      .filter(e => !seen.has(e.pflanze_slug) && seen.add(e.pflanze_slug))
      .sort((a, b) => a.pflanze_name.localeCompare(b.pflanze_name, 'de'))
  }, [calendar])

  const groups = useMemo(() => groupTasksByPlant(tasks), [tasks])

  const toggle = useCallback(async (task) => {
    const id = `${task.user_plant_id}:${task.task_key}`
    if (busyKeys.has(id)) return
    setBusyKeys(prev => new Set(prev).add(id))
    setError('')

    const next = !task.done
    // Optimistisch umschalten, bei Fehler zurückrollen.
    onTasksChange(prev => prev.map(t =>
      t.user_plant_id === task.user_plant_id && t.task_key === task.task_key
        ? { ...t, done: next }
        : t,
    ))

    try {
      if (next) await markTaskDone(task.user_plant_id, task.task_key)
      else await unmarkTaskDone(task.user_plant_id, task.task_key)
    } catch {
      onTasksChange(prev => prev.map(t =>
        t.user_plant_id === task.user_plant_id && t.task_key === task.task_key
          ? { ...t, done: task.done }
          : t,
      ))
      setError('Das hat nicht geklappt. Bitte versuch es noch einmal.')
    } finally {
      setBusyKeys(prev => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }, [busyKeys, onTasksChange])

  return (
    <>
      <div
        role="tablist"
        aria-label="Kalender-Linse"
        style={{ display: 'flex', gap: 14, marginBottom: 16, borderBottom: '1px solid var(--hairline)' }}
      >
        {LENSES.map(l => {
          const active = lens === l.key
          return (
            <button
              key={l.key}
              role="tab"
              aria-selected={active}
              onClick={() => setLens(l.key)}
              data-track-id={`kalender-lens-${l.key}`}
              style={{
                padding: '0 0 8px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {l.label}
            </button>
          )
        })}
      </div>

      {lens === 'saison' && (
        <SaisonLens monat={monat} erntereif={erntereif} loading={calendarLoading} />
      )}
      {lens === 'arbeit' && (
        <ArbeitLens
          monat={monat}
          groups={groups}
          loading={tasksLoading}
          busyKeys={busyKeys}
          onToggle={toggle}
          error={error}
        />
      )}
    </>
  )
}
