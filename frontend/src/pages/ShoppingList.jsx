// 10 · Einkaufsliste (SPEC §10, screens/shoppingliste.html — Screens 2 & 3)
//
// Bewusste Abweichungen vom Prototyp (Lead-entschieden → Merkliste):
// - Toggle „Summiert ↔ Nach Rezept" statt „Warengruppe ↔ Nach Rezept"
//   (Warengruppen haben keine Datenquelle).
// - Keine Pantry-Hinweise („vorhanden", „in deinen Basics", „evtl. in deinem Beet").
// - Keine Mic-Schnelleingabe, kein Teilen-Sheet.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addManual, clearDone, deleteItem, getList, toggleItem,
} from '../api/shopping'
import { plantImageStyle } from '../theme/plants'

const VIEWS = [
  { key: 'sum', label: 'Summiert' },
  { key: 'recipe', label: 'Nach Rezept' },
]

// ── Fortschritt ──────────────────────────────────────────────────────────────

function ProgressBar({ progress }) {
  const { total, done, percent } = progress
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--on-dark)' }}>
          {done} von {total} erledigt
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--gold-bright)' }}>
          {percent} %
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fortschritt der Einkaufsliste"
        style={{ height: 5, borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}
      >
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--gold-bright)', transition: 'width .25s ease' }} />
      </div>
    </div>
  )
}

// ── Positions-Zeile ──────────────────────────────────────────────────────────

function ItemRow({ item, busy, onToggle, onDelete }) {
  const menge = [item.amount, item.unit].filter(Boolean).join(' ')
  const merged = (item.merged_from_count || 1) > 1

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 2px' }}>
      <button
        onClick={onToggle}
        disabled={busy}
        aria-pressed={item.checked}
        aria-label={`${item.name} ${item.checked ? 'nicht erledigt' : 'erledigt'} setzen`}
        data-track-id="shopping-item-toggle"
        style={{
          width: 21, height: 21, flexShrink: 0, marginTop: 1, borderRadius: 5,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          border: item.checked ? 'none' : '1.5px solid var(--border-input)',
          background: item.checked ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
      >
        {item.checked && <i className="ti ti-check" style={{ fontSize: 13, color: 'var(--on-accent)' }} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.35,
          color: item.checked ? 'var(--text-muted)' : 'var(--text)',
          textDecoration: item.checked ? 'line-through' : 'none',
        }}>
          {menge && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: item.checked ? 'var(--text-muted)' : 'var(--gold)' }}>
              {menge}{' '}
            </span>
          )}
          {item.name}
        </p>
        {merged && (
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            ⊕ {item.merged_from_count} Rezepte · summiert
            {item.recipe_titles?.length > 0 && ` · ${item.recipe_titles.join(', ')}`}
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        disabled={busy}
        aria-label={`${item.name} entfernen`}
        data-track-id="shopping-item-delete"
        style={{
          flexShrink: 0, background: 'none', border: 'none', padding: 4,
          cursor: busy ? 'default' : 'pointer', color: 'var(--text-muted)', lineHeight: 1,
        }}
      >
        <i className="ti ti-x" style={{ fontSize: 13 }} />
      </button>
    </div>
  )
}

// ── Zutat hinzufügen ─────────────────────────────────────────────────────────

function AddItemForm({ onAdd, busy }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const nameRef = useRef(null)

  useEffect(() => { if (open) nameRef.current?.focus() }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd({ name: name.trim(), amount: amount.trim(), unit: unit.trim() })
    setName(''); setAmount(''); setUnit('')
    nameRef.current?.focus()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-track-id="shopping-add-manual"
        style={{
          width: '100%', marginTop: 16, padding: '12px 16px',
          borderRadius: 'var(--radius-input)', cursor: 'pointer',
          border: '1.5px dashed var(--wood-shadow)', background: 'transparent',
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}
      >
        <i className="ti ti-plus" style={{ fontSize: 14 }} /> Zutat hinzufügen
      </button>
    )
  }

  const field = {
    border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)',
    padding: '9px 11px', fontFamily: 'var(--font-body)', fontSize: 13,
    background: 'var(--surface)', color: 'var(--text)', minWidth: 0,
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
               placeholder="Zutat" aria-label="Zutat"
               data-track-id="shopping-add-name" style={{ ...field, flex: 2 }} />
        <input value={amount} onChange={e => setAmount(e.target.value)}
               placeholder="Menge" aria-label="Menge"
               data-track-id="shopping-add-amount" style={{ ...field, flex: 1 }} />
        <input value={unit} onChange={e => setUnit(e.target.value)}
               placeholder="Einheit" aria-label="Einheit"
               data-track-id="shopping-add-unit" style={{ ...field, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          data-track-id="shopping-add-submit"
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-input)', border: 'none',
            background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            cursor: busy || !name.trim() ? 'default' : 'pointer',
            opacity: busy || !name.trim() ? 0.5 : 1,
          }}
        >
          Hinzufügen
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setName(''); setAmount(''); setUnit('') }}
          data-track-id="shopping-add-cancel"
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-input)',
            border: '1.5px solid var(--border-input)', background: 'transparent',
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const [view, setView] = useState('recipe')  // Default: Nach Rezept
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyIds, setBusyIds] = useState(new Set())
  const [menuOpen, setMenuOpen] = useState(false)

  const load = useCallback((group, signal) => {
    return getList(group, signal ? { signal } : {}).then(setData)
  }, [])

  useEffect(() => {
    document.title = 'Einkaufsliste – PiEngines Recipes'
    const controller = new AbortController()
    setLoading(true)
    load(view, controller.signal)
      .catch(err => { if (err.name !== 'CanceledError') setError('Die Liste konnte nicht geladen werden.') })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [view, load])

  const withBusy = useCallback(async (ids, fn) => {
    setBusyIds(prev => new Set([...prev, ...ids]))
    setError('')
    try {
      await fn()
      await load(view)
    } catch {
      setError('Das hat nicht geklappt. Bitte versuch es noch einmal.')
    } finally {
      setBusyIds(prev => {
        const s = new Set(prev)
        ids.forEach(i => s.delete(i))
        return s
      })
    }
  }, [view, load])

  // In der summierten Ansicht steht eine Zeile für mehrere Positionen —
  // dann müssen alle Quellen mitgeschaltet werden.
  const handleToggle = useCallback((item) => {
    const ids = item.source_ids?.length ? item.source_ids : [item.id]
    const next = !item.checked
    return withBusy(ids, () => Promise.all(ids.map(id => toggleItem(id, next))))
  }, [withBusy])

  const handleDelete = useCallback((item) => {
    const ids = item.source_ids?.length ? item.source_ids : [item.id]
    return withBusy(ids, () => Promise.all(ids.map(id => deleteItem(id))))
  }, [withBusy])

  const handleAdd = useCallback((payload) => withBusy([], () => addManual(payload)), [withBusy])

  const handleClearDone = useCallback(() => {
    setMenuOpen(false)
    return withBusy([], () => clearDone())
  }, [withBusy])

  const progress = data?.progress || { total: 0, done: 0, percent: 0 }
  const leer = !loading && progress.total === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Dunkler Kopf (Braun-Welt) */}
      <div style={{ background: 'var(--ink-braun)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)' }}>
                Einkauf
              </p>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(21px, 4vw, 28px)', lineHeight: 1, color: 'var(--on-dark)' }}>
                Einkaufsliste
              </h1>
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Weitere Aktionen"
                aria-expanded={menuOpen}
                data-track-id="shopping-menu-toggle"
                style={{
                  background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 'var(--radius-tag)', padding: '7px 11px', cursor: 'pointer',
                  color: 'var(--on-dark)', lineHeight: 1,
                }}
              >
                <i className="ti ti-dots" style={{ fontSize: 15 }} />
              </button>
              {menuOpen && (
                <button
                  onClick={handleClearDone}
                  data-track-id="shopping-clear-done"
                  style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 5,
                    whiteSpace: 'nowrap', padding: '10px 14px', cursor: 'pointer',
                    background: 'var(--surface)', border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)',
                    fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
                  }}
                >
                  Erledigte entfernen
                </button>
              )}
            </div>
          </div>
          {!leer && <ProgressBar progress={progress} />}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 6rem' }}>
        {/* Gruppieren-Umschalter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Gruppieren
          </span>
          <div role="tablist" aria-label="Gruppierung" style={{ display: 'flex', gap: 2, background: 'var(--bg-alt)', borderRadius: 'var(--radius-tag)', padding: 2 }}>
            {VIEWS.map(v => {
              const active = view === v.key
              return (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v.key)}
                  data-track-id="shopping-group-toggle"
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    borderRadius: 'var(--radius-tag)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.04em',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p role="status" style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 40, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : leer ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <i className="ti ti-basket" aria-hidden="true" style={{ fontSize: 42, color: 'var(--text-muted)' }} />
            <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
              Deine Einkaufsliste ist leer. Übernimm Zutaten aus einem Rezept oder füge sie von Hand hinzu.
            </p>
          </div>
        ) : view === 'sum' ? (
          <section id="shopping-summiert" aria-label="Einkaufsliste, summiert">
            {(data?.items || []).map(item => (
              <ItemRow
                key={item.id}
                item={item}
                busy={busyIds.has(item.id)}
                onToggle={() => handleToggle(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </section>
        ) : (
          <section id="shopping-nach-rezept" aria-label="Einkaufsliste, nach Rezept">
            {(data?.groups || []).map(group => (
              <div key={group.recipe_id ?? 'manuell'} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-tile)', flexShrink: 0, ...plantImageStyle }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.recipe_title}
                    </p>
                    <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                      {group.position_count} Pos.
                    </p>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--hairline)' }}>
                  {group.items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      busy={busyIds.has(item.id)}
                      onToggle={() => handleToggle(item)}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <AddItemForm onAdd={handleAdd} busy={busyIds.size > 0} />
      </div>
    </div>
  )
}
