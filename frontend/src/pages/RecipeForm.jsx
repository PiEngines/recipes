import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import MediaUpload from '../components/MediaUpload'
import { useAuth } from '../context/AuthContext'
import { isKochOrAbove } from '../utils/roles'

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ['g', 'kg', 'ml', 'l', 'EL', 'TL', 'Stück', 'Prise', 'Bund', 'Scheibe', 'Dose', 'Packung', 'nach Geschmack']

// ── Utilities ─────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase()
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[b.length]
}

function fmtTime(d) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function diffColor(d) {
  if (d <= 3) return '#6B7C4E'
  if (d <= 6) return '#C8A020'
  return '#C8602A'
}

const IS_INTEGER_WORDS = new Set(['ei', 'eier', 'eigelb', 'eigelbe', 'eidotter', 'eiklar', 'eiweiß', 'eiweiss', 'eiweiße', 'eiweisse', 'dotter', 'wachtelei', 'wachteleier'])
function autoIsInteger(name) {
  const lower = name.toLowerCase().trim()
  const first = lower.split(/\s+/)[0]
  return IS_INTEGER_WORDS.has(lower) || IS_INTEGER_WORDS.has(first)
}
const mkIng = () => ({ _key: `ing_${Date.now()}_${Math.random()}`, component_label: '', name: '', amount: '', unit: '', is_integer: false, _auto_int: true, _module_recipe_id: null, _module_component_id: null, _servings_override: '', _scale_factor: '', _module_is_new: false })
const mkStep = () => ({ _key: `step_${Date.now()}_${Math.random()}`, dbId: null, title: '', instruction: '', timer_minutes: '', timer_label: '', timer_label_use_title: true })

function groupIngsByLabel(ings) {
  if (!ings.length) return []
  const groups = []
  let cur = { label: ings[0].component_label, items: [ings[0]] }
  for (let i = 1; i < ings.length; i++) {
    if (ings[i].component_label === cur.label) { cur.items.push(ings[i]) }
    else { groups.push(cur); cur = { label: ings[i].component_label, items: [ings[i]] } }
  }
  groups.push(cur)
  return groups
}

function ingrToText(ings) {
  const lines = []
  let prevLabel = null
  for (const ing of ings) {
    if (ing._module_recipe_id) continue
    const label = ing.component_label || ''
    if (label !== prevLabel) {
      if (label) lines.push(`## ${label}`)
      prevLabel = label
    }
    if (ing.name.trim()) lines.push([ing.amount, ing.unit, ing.name].filter(Boolean).join(' '))
  }
  return lines.join('\n')
}

function parseIngText(text) {
  const lines = text.split('\n')
  const results = []
  let currentLabel = ''
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('##')) { currentLabel = line.replace(/^##\s*/, '').trim(); continue }
    if (line.startsWith('[') && line.endsWith(']')) { currentLabel = line.slice(1, -1).trim(); continue }
    let rest = line
    let amount = ''
    const am = rest.match(/^([0-9]+(?:[.,][0-9]+)?(?:\/[0-9]+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*/)
    if (am) { amount = am[1]; rest = rest.slice(am[0].length) }
    let unit = ''
    for (const u of UNITS) {
      if (rest.toLowerCase().startsWith(u.toLowerCase())) {
        const after = rest.slice(u.length)
        if (!after || /^\s/.test(after)) { unit = u; rest = after.trimStart(); break }
      }
    }
    const name = rest.trim()
    if (!name) continue
    results.push({ _key: `ing_${Date.now()}_${Math.random()}`, component_label: currentLabel, name, amount, unit, is_integer: autoIsInteger(name), _auto_int: true, _module_recipe_id: null, _module_component_id: null, _servings_override: '', _scale_factor: '', _module_is_new: false })
  }
  return results
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Fortfahren', confirmDanger = false }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.75rem', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
            Abbrechen
          </button>
          <button onClick={onConfirm} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-input)', background: confirmDanger ? '#C84444' : 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewNavDialog({ onSaveAndGo, onDiscardAndGo, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.75rem', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Du hast ungespeicherte Änderungen. Wie möchtest du fortfahren?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <button onClick={onSaveAndGo} style={{ padding: '0.625rem 1.25rem', border: 'none', borderRadius: 'var(--radius-input)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600 }}>
            Speichern &amp; weiter
          </button>
          <button onClick={onDiscardAndGo} style={{ padding: '0.625rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
            Ohne Speichern weiter
          </button>
          <button onClick={onCancel} style={{ padding: '0.625rem 1.25rem', border: 'none', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--subtext)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
      {required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

function StyledInput({ value, onChange, type = 'text', placeholder, min, max, autoFocus }) {
  const [focused, setFocused] = useState(false)
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} min={min} max={max} autoFocus={autoFocus} style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none', boxSizing: 'border-box' }} />
  )
}

function StyledTextarea({ value, onChange, placeholder, rows = 4 }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} rows={rows} style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none', boxSizing: 'border-box', resize: 'vertical' }} />
  )
}

function SmallInput({ value, onChange, placeholder, onFocus, onBlur }) {
  const [focused, setFocused] = useState(false)
  return (
    <input value={value} onChange={e => onChange(e.target.value)} onFocus={() => { setFocused(true); onFocus?.() }} onBlur={() => { setFocused(false); onBlur?.() }} placeholder={placeholder} style={{ width: '100%', padding: '0.45rem 0.625rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease', minWidth: 0 }} />
  )
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1.25rem', paddingBottom: '0.625rem', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon && <span>{icon}</span>}{title}
      </h2>
      {children}
    </div>
  )
}

function Pill({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.625rem 0.3rem 0.875rem', background: 'rgba(200,96,42,0.1)', color: 'var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.85rem', fontWeight: 500 }}>
      {label}
      <button onClick={onRemove} style={{ background: 'rgba(200,96,42,0.15)', border: 'none', cursor: 'pointer', color: 'var(--accent)', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', padding: 0, fontWeight: 700, flexShrink: 0 }}>×</button>
    </span>
  )
}

function MoveBtn({ onClick, disabled, title, children }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{ width: '26px', height: '26px', border: '1.5px solid var(--border-input)', borderRadius: '6px', background: disabled ? 'transparent' : 'var(--card)', color: disabled ? 'var(--border-input)' : 'var(--subtext)', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: 0, transition: 'var(--transition)', flexShrink: 0 }}>{children}</button>
  )
}

function AddRowBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1.5px dashed var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500, marginTop: '0.375rem', transition: 'border-color 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)' }}>
      {children}
    </button>
  )
}

// ── TaxonomyField ─────────────────────────────────────────────────────────────

function TaxonomyField({ label, apiPath, selected, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [duplicate, setDuplicate] = useState(null) // { id, name } | null
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [creating, setCreating] = useState(false)
  const wrapRef = useRef(null)
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    if (!open) return
    const h = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); setDuplicate(null); setOpen(false); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await client.get(apiPath, { params: { search: input } })
        const filtered = data.filter(item => !selectedRef.current.some(s => s.id === item.id))
        setSuggestions(filtered)
        const near = filtered.find(s => { const d = levenshtein(input, s.name); return d > 0 && d <= 2 })
        setDuplicate(near || null)
        setOpen(true)
      } catch {}
    }, 200)
    return () => clearTimeout(t)
  }, [input, apiPath])

  const exactMatch = suggestions.find(s => s.name.toLowerCase() === input.toLowerCase().trim())
  const canCreate = input.trim().length > 0 && !exactMatch
  const showDropdown = open && (suggestions.length > 0 || canCreate)

  const pick = item => {
    onAdd(item); setInput(''); setSuggestions([]); setDuplicate(null); setOpen(false)
  }

  const handleCreate = async () => {
    if (!input.trim() || creating) return
    setCreating(true)
    try {
      const { data } = await client.post(apiPath, { name: input.trim() })
      pick(data)
    } catch (err) {
      if (err.response?.status === 409) {
        const detail = err.response.data?.detail
        if (detail?.suggestion) {
          // Close dropdown, show prominent warning
          setOpen(false)
          setDuplicate({ id: detail.suggestion_id ?? null, name: detail.suggestion })
        }
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
          {selected.map(item => <Pill key={item.id} label={item.name} onRemove={() => onRemove(item.id)} />)}
        </div>
      )}

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true) }} onBlur={() => setFocused(false)} placeholder={placeholder} style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: showDropdown ? 'var(--radius-input) var(--radius-input) 0 0' : 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', boxShadow: focused ? '0 0 0 3px rgba(200,96,42,0.12)' : 'none', boxSizing: 'border-box' }} />

        {showDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1.5px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 var(--radius-input) var(--radius-input)', boxShadow: 'var(--shadow-hover)', zIndex: 100, maxHeight: '180px', overflowY: 'auto' }}>
            {suggestions.map((s, i) => (
              <button key={s.id} onMouseDown={e => { e.preventDefault(); pick(s) }} style={{ width: '100%', padding: '0.5rem 0.875rem', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', display: 'block' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{s.name}</button>
            ))}
            {canCreate && (
              <button onMouseDown={e => { e.preventDefault(); handleCreate() }} style={{ width: '100%', padding: '0.5rem 0.875rem', background: 'none', border: 'none', borderTop: suggestions.length > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: creating ? 'wait' : 'pointer', color: 'var(--accent)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', fontWeight: 500, display: 'block' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                {creating ? '⏳ Erstelle …' : `+ Neu: „${input.trim()}"`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 409 / Levenshtein duplicate warning */}
      {duplicate && (
        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(200,160,32,0.1)', border: '1px solid rgba(200,160,32,0.35)', borderRadius: 'var(--radius-input)', fontSize: '0.85rem', color: '#A68000', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>⚠ Bereits vorhanden. Meintest du:</span>
          {duplicate.id != null ? (
            <button onClick={() => { if (!selectedRef.current.some(s => s.id === duplicate.id)) pick(duplicate); else { setInput(''); setDuplicate(null) } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A68000', fontWeight: 700, textDecoration: 'underline', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', padding: 0 }}>
              {duplicate.name}?
            </button>
          ) : (
            <strong>{duplicate.name}?</strong>
          )}
          <button onClick={() => setDuplicate(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#A68000', fontSize: '0.85rem', padding: 0 }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ── IngredientNameInput ───────────────────────────────────────────────────────

function IngredientNameInput({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await client.get('/api/recipes/ingredients/suggestions', { params: { search: query } })
        setSuggestions(data.filter(s => s.toLowerCase() !== value.toLowerCase()))
        setOpen(data.length > 0)
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div ref={wrapRef} style={{ flex: '2 1 100px', minWidth: 0, position: 'relative' }}>
      <input value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Name *" style={{ width: '100%', padding: '0.45rem 0.625rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: open && suggestions.length > 0 ? 'var(--radius-input) var(--radius-input) 0 0' : 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease', minWidth: 0 }} />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1.5px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 var(--radius-input) var(--radius-input)', boxShadow: 'var(--shadow-hover)', zIndex: 50, maxHeight: '130px', overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <button key={s} onMouseDown={e => { e.preventDefault(); onChange(s.trim()); setOpen(false) }} style={{ width: '100%', padding: '0.35rem 0.625rem', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', display: 'block' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── UnitCombobox ──────────────────────────────────────────────────────────────

function UnitCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef(null)
  const filtered = UNITS.filter(u => !value || u.toLowerCase().includes(value.toLowerCase()))

  useEffect(() => {
    if (!open) return
    const h = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={wrapRef} style={{ flex: '1 1 60px', minWidth: 0, position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => { setFocused(true); setOpen(true) }} onBlur={() => setFocused(false)} placeholder="Einheit" style={{ width: '100%', padding: '0.45rem 0.625rem', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: open && filtered.length > 0 ? 'var(--radius-input) var(--radius-input) 0 0' : 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease', minWidth: 0 }} />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1.5px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 var(--radius-input) var(--radius-input)', boxShadow: 'var(--shadow-hover)', zIndex: 50, maxHeight: '160px', overflowY: 'auto' }}>
          {filtered.map((u, i) => (
            <button key={u} onMouseDown={e => { e.preventDefault(); onChange(u); setOpen(false) }} style={{ width: '100%', padding: '0.35rem 0.625rem', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', display: 'block' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{u}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── IngredientRow ─────────────────────────────────────────────────────────────

function IngredientRow({ item, index, total, onChange, onMove, onRemove, hideLabel }) {
  return (
    <div style={{ padding: '0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          <MoveBtn onClick={() => onMove(-1)} disabled={index === 0} title="Nach oben">↑</MoveBtn>
          <MoveBtn onClick={() => onMove(1)} disabled={index === total - 1} title="Nach unten">↓</MoveBtn>
        </div>
        {!hideLabel && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <SmallInput value={item.component_label} onChange={v => onChange('component_label', v)} placeholder="Gruppe (optional)" />
          </div>
        )}
        <button onClick={onRemove} title="Entfernen" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'none', border: '1.5px solid var(--border-input)', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '3.5rem' }}>
        <IngredientNameInput
          value={item.name}
          onChange={v => {
            onChange('name', v)
            if (item._auto_int) onChange('is_integer', autoIsInteger(v))
          }}
        />
        <div style={{ flex: '1 1 60px', minWidth: 0 }}>
          <SmallInput value={item.amount} onChange={v => onChange('amount', v)} placeholder="Menge" />
        </div>
        <UnitCombobox value={item.unit} onChange={v => onChange('unit', v)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem', paddingLeft: '3.5rem', fontSize: '0.78rem', color: 'var(--subtext)', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={item.is_integer ?? false}
          onChange={e => { onChange('is_integer', e.target.checked); onChange('_auto_int', false) }}
          style={{ accentColor: 'var(--accent)', width: '13px', height: '13px' }}
        />
        Nur ganze Stück
      </label>
    </div>
  )
}

// ── StepRow ───────────────────────────────────────────────────────────────────

function StepRow({ item, index, total, onChange, onMove, onRemove, onMediaChange, onStepMediaReload }) {
  const [instrFocused, setInstrFocused] = useState(false)
  const effectiveTimerLabel = item.timer_label_use_title ? item.title : item.timer_label

  return (
    <div style={{ padding: '0.875rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', marginBottom: '0.75rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
        <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{index + 1}</span>
        <MoveBtn onClick={() => onMove(-1)} disabled={index === 0} title="Nach oben">↑</MoveBtn>
        <MoveBtn onClick={() => onMove(1)} disabled={index === total - 1} title="Nach unten">↓</MoveBtn>
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ padding: '0.25rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>Entfernen</button>
      </div>

      {/* Step title (optional heading) */}
      <div style={{ marginBottom: '0.5rem' }}>
        <SmallInput value={item.title} onChange={v => onChange('title', v)} placeholder="Überschrift (optional)" />
      </div>

      {/* Instruction */}
      <textarea value={item.instruction} onChange={e => onChange('instruction', e.target.value)} onFocus={() => setInstrFocused(true)} onBlur={() => setInstrFocused(false)} placeholder="Schritt beschreiben …" rows={3} style={{ width: '100%', padding: '0.5rem 0.75rem', border: `1.5px solid ${instrFocused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.15s ease', marginBottom: '0.625rem' }} />

      {/* Footer: timer + label + photo placeholder */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', whiteSpace: 'nowrap' }}>⏱ Timer (min):</span>
          <input type="number" min="1" value={item.timer_minutes} onChange={e => onChange('timer_minutes', e.target.value)} placeholder="—" style={{ width: '70px', padding: '0.3rem 0.5rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {item.timer_minutes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="text" value={effectiveTimerLabel} onChange={e => { if (!item.timer_label_use_title) onChange('timer_label', e.target.value) }} disabled={item.timer_label_use_title} placeholder="Timer-Bezeichnung (optional)" style={{ flex: 1, minWidth: 0, padding: '0.3rem 0.5rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: item.timer_label_use_title ? 'var(--border-input)' : 'var(--bg)', color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', opacity: item.timer_label_use_title ? 0.6 : 1 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--subtext)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={item.timer_label_use_title} onChange={e => onChange('timer_label_use_title', e.target.checked)} style={{ accentColor: 'var(--accent)', width: '13px', height: '13px' }} />
              Wie Schritt-Überschrift
            </label>
          </div>
        )}

      </div>

      {/* Schritt-Fotos */}
      {item.dbId ? (
        <div style={{ marginTop: '0.75rem' }}>
          <MediaUpload
            entityType="step"
            entityId={item.dbId}
            existingMedia={item.media || []}
            onMediaChange={() => onStepMediaReload?.(item.dbId, item._key)}
            allowVideo={false}
          />
        </div>
      ) : (
        <button disabled style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', border: '1.5px dashed var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'default', color: 'var(--subtext)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          📷 Fotos <span style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>(nach erstem Speichern)</span>
        </button>
      )}
    </div>
  )
}

// ── MediaGallery ──────────────────────────────────────────────────────────────

function MediaGallery({ media, onReload, showSetPrimary = true }) {
  const images = (media || [])
    .filter(m => m.media_type === 'image' && !m.deleted_at)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  if (!images.length) return null

  const doDelete = async (id) => {
    try { await client.delete(`/api/media/${id}`); onReload() } catch {}
  }
  const doSetPrimary = async (id) => {
    try { await client.patch(`/api/media/${id}/set-primary`); onReload() } catch {}
  }
  const doReorder = async (id, targetId) => {
    const a = images.find(m => m.id === id)
    const b = images.find(m => m.id === targetId)
    if (!a || !b) return
    try {
      await Promise.all([
        client.patch(`/api/media/${id}`, { sort_order: b.sort_order ?? images.indexOf(b) }),
        client.patch(`/api/media/${targetId}`, { sort_order: a.sort_order ?? images.indexOf(a) }),
      ])
      onReload()
    } catch {}
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginTop: '0.875rem' }}>
      {images.map((m, idx) => (
        <div key={m.id} style={{
          position: 'relative',
          border: `2px solid ${m.is_primary ? '#C8602A' : 'transparent'}`,
          borderRadius: '10px',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <img
            src={m.thumbnail_url || m.url}
            alt=""
            style={{ height: '100px', width: 'auto', display: 'block', objectFit: 'cover' }}
          />
          {m.is_primary && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(200,96,42,0.88)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', padding: '2px 0', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Titelbild
            </div>
          )}
          <button onClick={() => doDelete(m.id)} title="Löschen" style={{ position: 'absolute', top: '3px', right: '3px', width: '19px', height: '19px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
          {showSetPrimary && !m.is_primary && (
            <button onClick={() => doSetPrimary(m.id)} title="Als Titelbild setzen" style={{ position: 'absolute', top: '3px', left: '3px', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.58rem', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>★</button>
          )}
          <div style={{ position: 'absolute', bottom: m.is_primary ? '16px' : '3px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
            {idx > 0 && (
              <button onClick={() => doReorder(m.id, images[idx - 1].id)} style={{ width: '17px', height: '17px', borderRadius: '3px', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>←</button>
            )}
            {idx < images.length - 1 && (
              <button onClick={() => doReorder(m.id, images[idx + 1].id)} style={{ width: '17px', height: '17px', borderRadius: '3px', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>→</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── RecipeForm (main) ─────────────────────────────────────────────────────────

export default function RecipeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  // Küchenhilfe darf keine Rezepte erstellen
  useEffect(() => {
    if (!isEdit && user && !isKochOrAbove(user)) navigate('/', { replace: true })
  }, [isEdit, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const [loadError, setLoadError] = useState(null)
  const [loadingRecipe, setLoadingRecipe] = useState(isEdit)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const pendingNavRef = useRef(null)

  // Snapshot for discard
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [source, setSource] = useState('')
  const [type, setType] = useState('kochen')
  const [selectedCats, setSelectedCats] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [ingredients, setIngredients] = useState([mkIng()])
  const [steps, setSteps] = useState([mkStep()])
  const [moduleSearch, setModuleSearch] = useState({})
  const moduleSearchTimers = useRef({})
  const [extractDialog, setExtractDialog] = useState(null)
  const [extracting, setExtracting] = useState(false)

  // Media state (managed independently of recipe API payload)
  const [recipeMedia, setRecipeMedia] = useState([])

  // Save state
  const [recipeId, setRecipeId] = useState(id ? parseInt(id) : null)
  const [savedAt, setSavedAt] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [savingAs, setSavingAs] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [toast, setToast] = useState(null)
  const [toastFading, setToastFading] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [aText, setAText] = useState('')
  const aTextInitRef = useRef(false)
  const [subRecipeOpen, setSubRecipeOpen] = useState(false)
  const [subRecipeQuery, setSubRecipeQuery] = useState('')
  const [subRecipeResults, setSubRecipeResults] = useState([])
  const [subRecipeLoading, setSubRecipeLoading] = useState(false)
  const [serveWith, setServeWith] = useState([])
  const [serveWithOpen, setServeWithOpen] = useState(false)
  const [serveWithQuery, setServeWithQuery] = useState('')
  const [serveWithResults, setServeWithResults] = useState([])
  const [serveWithLoading, setServeWithLoading] = useState(false)
  const [tippOpen, setTippOpen] = useState(false)
  const tippRef = useRef(null)
  const [moduleOrder, setModuleOrder] = useState([])
  const dragFromRef = useRef(null)

  const savingRef = useRef(false)
  const stateRef = useRef({})

  useEffect(() => {
    stateRef.current = {
      title, description, prepTime, cookTime, servings,
      difficulty, source, type,
      selectedCats, selectedTags,
      ingredients, steps,
      recipeId,
    }
  })

  const markDirty = useCallback(() => setIsDirty(true), [])

  useEffect(() => {
    if (wizardStep === 1 && !aTextInitRef.current) {
      aTextInitRef.current = true
      setAText(ingrToText(ingredients))
    }
  }, [wizardStep]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wizardStep !== 1) return
    const parsed = parseIngText(aText)
    setIngredients(prev => {
      const modules = prev.filter(i => i._module_recipe_id)
      return [...modules, ...(parsed.length ? parsed : [mkIng()])]
    })
  }, [aText]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!subRecipeOpen || !subRecipeQuery.trim()) { setSubRecipeResults([]); setSubRecipeLoading(false); return }
    setSubRecipeLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await client.get('/api/recipes', { params: { search: subRecipeQuery.trim(), as_module: true, page_size: 8 } })
        setSubRecipeResults(data.items || [])
      } catch {}
      setSubRecipeLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [subRecipeQuery, subRecipeOpen])

  useEffect(() => {
    if (!serveWithOpen || !serveWithQuery.trim()) { setServeWithResults([]); setServeWithLoading(false); return }
    setServeWithLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await client.get('/api/recipes', { params: { search: serveWithQuery.trim(), page_size: 8 } })
        setServeWithResults(data.items || [])
      } catch {}
      setServeWithLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [serveWithQuery, serveWithOpen])

  useEffect(() => {
    if (!tippOpen) return
    const h = e => { if (!tippRef.current?.contains(e.target)) setTippOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [tippOpen])

  useEffect(() => {
    if (wizardStep !== 2) return
    const mods = stateRef.current.ingredients.filter(i => i._module_recipe_id)
    setModuleOrder(['main', ...mods.map(m => m._key)])
  }, [wizardStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateStepMedia = useCallback((stepKey, media) => {
    setSteps(prev => prev.map(s => s._key === stepKey ? { ...s, media } : s))
  }, [])

  const reloadStepMedia = useCallback(async (dbId, stepKey) => {
    try {
      const { data } = await client.get(`/api/media/entity/step/${dbId}`)
      setSteps(prev => prev.map(s => s._key === stepKey ? { ...s, media: data } : s))
    } catch {}
  }, [])

  // Guarded navigation: show confirm dialog when there are unsaved changes
  const guardedNavigate = useCallback((path) => {
    if (isDirty && !savingRef.current) {
      pendingNavRef.current = path
      setShowLeaveConfirm(true)
    } else {
      navigate(path)
    }
  }, [isDirty, navigate])

  // Capture snapshot from loaded recipe data
  const applySnapshot = useCallback((snap) => {
    setTitle(snap.title)
    setDescription(snap.description)
    setPrepTime(snap.prepTime)
    setCookTime(snap.cookTime)
    setServings(snap.servings)
    setDifficulty(snap.difficulty)
    setSource(snap.source)
    setType(snap.type)
    setSelectedCats(snap.selectedCats)
    setSelectedTags(snap.selectedTags)
    setIngredients(snap.ingredients)
    setSteps(snap.steps)
    setIsDirty(false)
  }, [])

  // Load existing recipe in edit mode
  useEffect(() => {
    if (!isEdit) return
    client.get(`/api/recipes/${id}`)
      .then(({ data: r }) => {
        const ings = [...r.ingredients].sort((a, b) => a.sort_order - b.sort_order)
        const sps = [...r.steps].sort((a, b) => a.sort_order - b.sort_order)
        const snap = {
          title: r.title || '',
          description: r.description || '',
          prepTime: r.prep_time != null ? String(r.prep_time) : '',
          cookTime: r.cook_time != null ? String(r.cook_time) : '',
          servings: r.servings != null ? String(r.servings) : '',
          difficulty: r.difficulty ?? 5,
          source: r.source || '',
          type: r.type || 'kochen',
          selectedCats: r.categories,
          selectedTags: r.tags,
          ingredients: (() => {
            if (!ings.length) return [mkIng()]
            const compByTitle = {}
            for (const comp of (r.components || [])) {
              if (!compByTitle[comp.child_recipe_title]) compByTitle[comp.child_recipe_title] = comp
            }
            const moduleTitles = new Set(Object.keys(compByTitle))
            const seenModuleLabels = new Set()
            const mapped = []
            for (const i of ings) {
              const label = i.component_label || ''
              if (moduleTitles.has(label)) {
                if (!seenModuleLabels.has(label)) {
                  seenModuleLabels.add(label)
                  const comp = compByTitle[label]
                  mapped.push({
                    _key: `mod_${comp.child_recipe_id}`,
                    component_label: label,
                    name: label,
                    amount: '',
                    unit: '',
                    is_integer: false,
                    _auto_int: false,
                    _module_recipe_id: comp.child_recipe_id,
                    _module_component_id: comp.id,
                    _servings_override: comp.servings_override != null ? String(comp.servings_override) : '',
                    _scale_factor: comp.scale_factor != null ? String(comp.scale_factor) : '',
                    _module_is_new: false,
                  })
                }
              } else {
                mapped.push({
                  _key: `ing_${i.id}`,
                  component_label: label,
                  name: i.name,
                  amount: i.amount || '',
                  unit: i.unit || '',
                  is_integer: (i.is_integer ?? false) || autoIsInteger(i.name),
                  _auto_int: false,
                  _module_recipe_id: null,
                  _module_component_id: null,
                  _servings_override: '',
                  _scale_factor: '',
                  _module_is_new: false,
                })
              }
            }
            return mapped.length ? mapped : [mkIng()]
          })(),
          steps: sps.length
            ? sps.map(s => ({ _key: `step_${s.id}`, dbId: s.id, title: s.title || '', instruction: s.instruction, timer_minutes: s.timer_seconds ? String(Math.round(s.timer_seconds / 60)) : '', timer_label: s.timer_label || '', timer_label_use_title: false, media: [] }))
            : [mkStep()],
        }
        applySnapshot(snap)
        setSavedSnapshot(snap)
        // Load recipe media
        client.get(`/api/media/entity/recipe/${id}`)
          .then(({ data }) => setRecipeMedia(data))
          .catch(() => {})
        // Load step media in parallel
        if (sps.length) {
          Promise.all(
            sps.map(s =>
              client.get(`/api/media/entity/step/${s.id}`)
                .then(({ data }) => ({ key: `step_${s.id}`, media: data }))
                .catch(() => ({ key: `step_${s.id}`, media: [] }))
            )
          ).then(results => {
            setSteps(prev => prev.map(step => {
              const found = results.find(r => r.key === step._key)
              return found ? { ...step, media: found.media } : step
            }))
          })
        }
      })
      .catch(() => setLoadError('Rezept konnte nicht geladen werden.'))
      .finally(() => setLoadingRecipe(false))
  }, [id, isEdit, applySnapshot])

  // Snapshot beim Editor-Einstieg (einmalig, nur Edit-Modus)
  useEffect(() => {
    if (!id) return
    client.post(`/api/recipes/${id}/snapshot`).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build API payload from stateRef
  const buildPayload = useCallback(() => {
    const s = stateRef.current
    return {
      title: s.title,
      description: s.description || null,
      prep_time: s.prepTime !== '' ? parseInt(s.prepTime) : null,
      cook_time: s.cookTime !== '' ? parseInt(s.cookTime) : null,
      servings: s.servings !== '' ? parseInt(s.servings) : null,
      difficulty: s.difficulty || null,
      status: 'published',
      type: s.type,
      source: s.source || null,
      category_ids: s.selectedCats.map(c => c.id),
      tag_ids: s.selectedTags.map(t => t.id),
      ingredients: s.ingredients
          .filter(i => i.name.trim() && !i._module_recipe_id)
          .map((i, idx) => ({ component_label: i.component_label || null, name: i.name.trim(), amount: i.amount || null, unit: i.unit || null, sort_order: idx, is_integer: i.is_integer ?? false })),
      steps: s.steps
        .filter(st => st.instruction.trim())
        .map((st, idx) => ({
          id: st.dbId || null,
          sort_order: idx + 1,
          title: st.title || null,
          instruction: st.instruction,
          timer_seconds: st.timer_minutes ? parseInt(st.timer_minutes) * 60 : null,
          timer_label: st.timer_label_use_title ? null : (st.timer_label || null),
        })),
    }
  }, [])

  // Core save
  const doSave = useCallback(async (targetStatus, skipVersion = false) => {
    const s = stateRef.current
    if (!s.title.trim()) return null
    if (savingRef.current) return null
    savingRef.current = true
    setSavingAs('published')
    setSaveError(null)
    try {
      const payload = buildPayload()
      let result
      const rid = s.recipeId
      if (rid) {
        const params = skipVersion ? '?skip_version=true' : ''
        result = await client.put(`/api/recipes/${rid}${params}`, payload)
      } else {
        result = await client.post('/api/recipes', payload)
        const newId = result.data.id
        setRecipeId(newId)
        stateRef.current.recipeId = newId
        navigate(`/recipes/${newId}/edit`, { replace: true })
      }
      setSavedAt(new Date())
      setIsDirty(false)
      if (!skipVersion) setToast('Gespeichert')
      // Map DB step IDs back into form state
      const savedSteps = [...(result.data.steps || [])].sort((a, b) => a.sort_order - b.sort_order)
      setSteps(prev => {
        let saveIdx = 0
        return prev.map(step => {
          if (!step.instruction.trim()) return step
          const dbStep = savedSteps[saveIdx++]
          return dbStep ? { ...step, dbId: dbStep.id } : step
        })
      })
      return result.data
    } catch {
      setSaveError('Fehler beim Speichern. Bitte erneut versuchen.')
      return null
    } finally {
      savingRef.current = false
      setSavingAs(null)
    }
  }, [buildPayload, navigate])

  // Autosave condition
  const canAutosave = useCallback(() => {
    const s = stateRef.current
    if (!s.title.trim()) return false
    const chars =
      (s.description || '').length + (s.source || '').length +
      s.ingredients.reduce((n, i) => n + i.name.length + (i.amount || '').length, 0) +
      s.steps.reduce((n, st) => n + st.instruction.length, 0)
    return chars >= 80
  }, [])

  // 120-second autosave (no version)
  useEffect(() => {
    const iv = setInterval(() => { if (canAutosave()) doSave(undefined, true) }, 120_000)
    return () => clearInterval(iv)
  }, [canAutosave, doSave])

  // Toast auto-dismiss + click-to-dismiss
  useEffect(() => {
    if (!toast) return
    setToastFading(false)
    const tFade = setTimeout(() => setToastFading(true), 3000)
    const tClear = setTimeout(() => { setToast(null); setToastFading(false) }, 3300)
    const onClick = () => {
      clearTimeout(tFade); clearTimeout(tClear)
      setToastFading(true)
      setTimeout(() => { setToast(null); setToastFading(false) }, 300)
    }
    document.addEventListener('click', onClick, { once: true })
    return () => {
      clearTimeout(tFade); clearTimeout(tClear)
      document.removeEventListener('click', onClick)
    }
  }, [toast])

  // beforeunload autosave
  useEffect(() => {
    const handler = () => {
      if (!canAutosave()) return
      const s = stateRef.current
      if (!s.title.trim()) return
      const payload = buildPayload()
      const rid = s.recipeId
      const base = import.meta.env.VITE_API_BASE_URL || ''
      const url = rid ? `${base}/api/recipes/${rid}?skip_version=true` : `${base}/api/recipes`
      const token = localStorage.getItem('access_token')
      fetch(url, { method: rid ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload), keepalive: true }).catch(() => {})
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [buildPayload, canAutosave])

  // After saving, route to the ingredient-matching review flow when needed:
  // new recipes always go through it once; edits only if the ingredient list changed.
  const handleSaveAndMaybeReview = useCallback(async () => {
    const wasNew = !stateRef.current.recipeId
    const capturedIngs = [...stateRef.current.ingredients]
    const prevNames = new Set(
      capturedIngs.filter(i => i.name.trim()).map(i => i.name.trim().toLowerCase())
    )
    const data = await doSave()
    if (!data) return

    for (const ing of capturedIngs.filter(i => i._module_recipe_id && i._module_is_new)) {
      try {
        await client.post(`/api/recipes/${data.id}/components`, {
          child_recipe_id: ing._module_recipe_id,
          sort_order: 0,
          servings_override: ing._servings_override ? parseInt(ing._servings_override) || null : null,
          scale_factor: ing._scale_factor ? parseFloat(ing._scale_factor) || null : null,
        })
        setIngredients(prev => prev.map(i => i._key === ing._key ? { ...i, _module_is_new: false } : i))
      } catch {
        setToast('Ein Modul konnte nicht eingebunden werden.')
      }
    }

    if (wasNew) {
      navigate(`/recipes/${data.id}/review`)
      return
    }
    const newNames = new Set((data.ingredients || []).map(i => i.name.trim().toLowerCase()))
    const changed = newNames.size !== prevNames.size || [...newNames].some(n => !prevNames.has(n))
    if (changed) navigate(`/recipes/${data.id}/review`)
  }, [doSave, navigate])

  const handleExtract = useCallback(async () => {
    if (!extractDialog || extracting || !recipeId) return
    setExtracting(true)
    try {
      const res = await client.post(`/api/recipes/${recipeId}/components/extract`, {
        component_label: extractDialog.label,
        new_recipe_title: extractDialog.title.trim() || 'Neue Zubereitung',
      })
      const { new_recipe_id, new_recipe_title, component_id } = res.data
      const firstKey = extractDialog.firstKey
      setIngredients(prev => {
        const arr = [...prev]
        const fi = arr.findIndex(i => i._key === firstKey)
        if (fi >= 0) arr[fi] = { ...arr[fi], _module_recipe_id: new_recipe_id, _module_component_id: component_id, _module_is_new: false }
        return arr
      })
      setToast(`'${new_recipe_title}' wurde als eigenes Rezept angelegt`)
      setExtractDialog(null)
    } catch (e) {
      setToast(e.response?.data?.detail || 'Fehler beim Auslagern')
    } finally {
      setExtracting(false)
    }
  }, [extractDialog, extracting, recipeId])

  const handleSave = async () => { if (savingRef.current || !title.trim()) return; await handleSaveAndMaybeReview() }

  const handleReviewClick = () => {
    if (!recipeId) return
    if (isDirty) setShowReviewDialog(true)
    else navigate(`/recipes/${recipeId}/review`)
  }

  const handleReviewSaveAndGo = async () => {
    setShowReviewDialog(false)
    if (savingRef.current || !title.trim()) return
    const data = await doSave()
    if (data) navigate(`/recipes/${data.id}/review`)
  }

  const handleReviewDiscardAndGo = () => {
    setShowReviewDialog(false)
    navigate(`/recipes/${recipeId}/review`)
  }
  const handleDiscard = () => setShowDiscardConfirm(true)
  const handleDiscardConfirm = () => {
    setShowDiscardConfirm(false)
    if (savedSnapshot) applySnapshot(savedSnapshot)
    else navigate(recipeId ? `/recipes/${recipeId}` : '/')
  }

  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false)
    const path = pendingNavRef.current
    pendingNavRef.current = null
    if (path) navigate(path)
  }

  const handleLeaveCancel = () => {
    setShowLeaveConfirm(false)
    pendingNavRef.current = null
  }

  // Save status display
  const saveStatusText = savingAs ? 'Speichert …' : saveError ? saveError : isDirty ? 'Nicht gespeichert' : savedAt ? `Gespeichert um ${fmtTime(savedAt)}` : ''
  const saveStatusColor = saveError ? '#C84444' : isDirty ? '#C8A020' : savingAs ? 'var(--subtext)' : 'var(--secondary)'

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loadingRecipe) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--subtext)' }}>Lade Rezept …</div>
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--subtext)' }}>
        <p>{loadError}</p>
        <button onClick={() => navigate('/recipes')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>← Zurück zur Übersicht</button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const STEPS = ['Titel', 'Zutaten', 'Anordnung', 'Zubereitung', 'Feinschliff']
  const servingsNum = parseInt(servings) || 4
  const parsedA = wizardStep === 1 ? parseIngText(aText) : []
  const noModules = !ingredients.some(i => i._module_recipe_id)
  const realIngs = ingredients.filter(i => i.name.trim() && !i._module_recipe_id)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '80px' }}>
      <style>{`@keyframes ing-highlight { 0%{background:rgba(200,96,42,0.3)} 100%{background:rgba(200,96,42,0.1)} }`}</style>

      {/* Leave confirm dialog (Zurück-Button bei ungespeicherten Änderungen) */}
      {showLeaveConfirm && (
        <ConfirmDialog
          message="Du hast ungespeicherte Änderungen. Wenn du die Seite verlässt, gehen diese verloren."
          onConfirm={handleLeaveConfirm}
          onCancel={handleLeaveCancel}
          confirmLabel="Seite verlassen"
          confirmDanger
        />
      )}

      {/* Discard confirm dialog */}
      {showDiscardConfirm && (
        <ConfirmDialog
          message="Alle ungespeicherten Änderungen gehen verloren. Fortfahren?"
          onConfirm={handleDiscardConfirm}
          onCancel={() => setShowDiscardConfirm(false)}
          confirmLabel="Verwerfen"
          confirmDanger
        />
      )}

      {/* Review-Navigation: ungespeicherte Änderungen */}
      {showReviewDialog && (
        <ReviewNavDialog
          onSaveAndGo={handleReviewSaveAndGo}
          onDiscardAndGo={handleReviewDiscardAndGo}
          onCancel={() => setShowReviewDialog(false)}
        />
      )}

      {/* Extract ingredient group dialog */}
      {extractDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.75rem', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ margin: '0 0 0.875rem', color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Gruppe als eigenes Rezept auslagern?
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--subtext)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Titel des neuen Rezepts</label>
              <StyledInput
                value={extractDialog.title}
                onChange={v => setExtractDialog(prev => ({ ...prev, title: v }))}
                placeholder="Titel …"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setExtractDialog(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
                Abbrechen
              </button>
              <button
                data-track-id="form-ingredient-group-extract-confirm"
                onClick={handleExtract}
                disabled={extracting || !extractDialog.title.trim()}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 'var(--radius-input)', background: (extracting || !extractDialog.title.trim()) ? 'var(--border-input)' : 'var(--accent)', color: '#fff', cursor: (extracting || !extractDialog.title.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {extracting ? 'Wird ausgelagert …' : 'Auslagern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard header */}
      <header style={{ position: 'sticky', top: '64px', zIndex: 50, background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
        {/* Top row */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => guardedNavigate(recipeId ? `/recipes/${recipeId}` : '/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.875rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ← {isEdit ? 'Detailseite' : 'Übersicht'}
          </button>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {title || (isEdit ? 'Rezept bearbeiten' : 'Neues Rezept')}
          </h1>
          {saveStatusText && (
            <span className="hidden sm:inline" style={{ fontSize: '0.75rem', color: saveStatusColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{saveStatusText}</span>
          )}
          {isEdit && (
            <button onClick={handleDiscard} className="hidden sm:inline"
              style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', flexShrink: 0 }}>
              Verwerfen
            </button>
          )}
        </div>

      </header>

      {/* Main area */}
      <div style={{ display: 'flex', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Desktop sidebar stepper */}
        <aside className="hidden sm:flex" style={{ width: '200px', flexShrink: 0, flexDirection: 'column', padding: '1.5rem 0', borderRight: '1px solid var(--border)', background: 'var(--card)', minHeight: 'calc(100vh - 128px)' }}>
          {STEPS.map((label, i) => {
            const stepGrayed = i === 2 && noModules
            return (
              <button key={i} onClick={stepGrayed ? undefined : () => setWizardStep(i)} data-track-id={`recipe-form-step-${i}-click`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', border: 'none', borderLeft: `3px solid ${wizardStep === i ? 'var(--accent)' : 'transparent'}`, background: wizardStep === i ? 'rgba(200,96,42,.06)' : 'none', cursor: stepGrayed ? 'default' : 'pointer', textAlign: 'left', opacity: stepGrayed ? 0.4 : 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: wizardStep === i ? 'var(--accent)' : (i < wizardStep ? '#6B7C4E' : 'var(--border-input)'), color: (wizardStep === i || i < wizardStep) ? '#fff' : 'var(--subtext)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>
                  {i < wizardStep ? '✓' : i + 1}
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: wizardStep === i ? 600 : 400, color: wizardStep === i ? 'var(--accent)' : (i < wizardStep ? 'var(--secondary)' : 'var(--text)') }}>{label}</span>
              </button>
            )
          })}
        </aside>

        {/* Step content */}
        <main style={{ flex: 1, minWidth: 0, padding: '1.5rem' }}>

          {/* Step 0: Basis */}
          {wizardStep === 0 && (
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Wie heißt dein Rezept?</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginBottom: '1.5rem' }}>Du kannst den Titel jederzeit ändern.</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <FieldLabel required>Titel</FieldLabel>
                <StyledInput value={title} onChange={v => { setTitle(v); markDirty() }} placeholder="z. B. Pizzateig" autoFocus={!isEdit} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <FieldLabel>Beschreibung</FieldLabel>
                <StyledTextarea value={description} onChange={v => { setDescription(v); markDirty() }} placeholder="Kurze Beschreibung …" rows={3} />
              </div>
            </div>
          )}

          {/* Step 1: Zutaten */}
          {wizardStep === 1 && (
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Was kommt rein?</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>Eine Zeile pro Zutat — Menge, Einheit und Name.</p>
              {/* Portionen inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.625rem', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', color: 'var(--subtext)' }}>
                <span>Die Mengen gelten für</span>
                <button onClick={() => { setServings(String(Math.max(1, servingsNum - 1))); markDirty() }} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-input)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>−</button>
                <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: '1rem', textAlign: 'center' }}>{servingsNum}</span>
                <button onClick={() => { setServings(String(servingsNum + 1)); markDirty() }} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-input)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>+</button>
                <span>Portionen</span>
              </div>
              {/* Textarea + Live-Preview */}
              <div className="flex flex-col sm:flex-row" style={{ gap: '1.25rem', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <textarea
                    data-track-id="recipe-form-ingredients-text"
                    value={aText}
                    onChange={e => { setAText(e.target.value); markDirty() }}
                    placeholder={'200 g Mehl\n2 Eier\n1 Prise Salz\n\n## Sauce\n3 EL Olivenöl'}
                    rows={Math.max(6, aText.split('\n').length + 2)}
                    style={{ width: '100%', padding: '0.75rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,96,42,0.12)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
                  />
                  <div style={{ marginTop: '0.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                      <span>Tipp: Abschnitte mit <code style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>## Gruppenname</code> trennen</span>
                      <button onClick={() => setTippOpen(o => !o)} aria-label="Mehr erfahren" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>ⓘ</button>
                    </div>
                    {tippOpen && (
                      <div ref={tippRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200, background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1rem' }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Abschnitte gruppieren</div>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--subtext)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>Eine Leerzeile trennt Abschnitte, ## startet einen neuen mit Namen.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Eingabe</div>
                            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.7, color: 'var(--subtext)', whiteSpace: 'pre', background: 'var(--bg)', padding: '0.5rem', borderRadius: 6 }}>{'## Soße\n200 ml Sahne\n1 Zwiebel\n\n## Teig\n300 g Mehl\n2 Eier'}</pre>
                          </div>
                          <div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Ergebnis</div>
                            <div style={{ fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Soße</div>
                              <div style={{ color: 'var(--subtext)' }}>200 ml Sahne</div>
                              <div style={{ color: 'var(--subtext)' }}>1 Zwiebel</div>
                              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.3rem' }}>Teig</div>
                              <div style={{ color: 'var(--subtext)' }}>300 g Mehl</div>
                              <div style={{ color: 'var(--subtext)' }}>2 Eier</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Teilrezept einbinden */}
                  <div style={{ marginTop: '0.75rem' }}>
                    {/* Module cards */}
                    {ingredients.filter(i => i._module_recipe_id).map(mod => {
                      const modIdx = ingredients.findIndex(i => i._key === mod._key)
                      const modServings = parseInt(mod._servings_override) || servingsNum
                      return (
                        <div key={mod._key} style={{ marginBottom: '0.5rem', padding: '0.75rem 0.875rem', background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 }}>🍵</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.name}</div>
                              {mod._author_label && (
                                <a href={`/recipes/${mod._module_recipe_id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}>{mod._author_label}</a>
                              )}
                            </div>
                            <button onClick={() => { setIngredients(prev => prev.filter(i => i._key !== mod._key)); markDirty() }} title="Entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1rem', padding: 0, flexShrink: 0, lineHeight: 1 }}>✕</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--subtext)' }}>Portionen:</span>
                            <button onClick={() => { setIngredients(prev => prev.map((ing, i) => i === modIdx ? { ...ing, _servings_override: String(Math.max(1, modServings - 1)) } : ing)); markDirty() }} style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-input)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>−</button>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', minWidth: '1.25rem', textAlign: 'center' }}>{modServings}</span>
                            <button onClick={() => { setIngredients(prev => prev.map((ing, i) => i === modIdx ? { ...ing, _servings_override: String(modServings + 1) } : ing)); markDirty() }} style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-input)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>+</button>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={() => setIngredients(prev => prev.map((ing, i) => i === modIdx ? { ...ing, _note_open: !ing._note_open } : ing))}
                              style={{ padding: '0.2rem 0.5rem', border: `1px solid ${mod._note_open ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: mod._note_open ? 'rgba(200,96,42,0.08)' : 'none', cursor: 'pointer', color: mod._note_open ? 'var(--accent)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}
                            >📝 Hinweis für den Koch</button>
                          </div>
                          {mod._note_open && (
                            <textarea
                              value={mod._note || ''}
                              onChange={e => setIngredients(prev => prev.map((ing, i) => i === modIdx ? { ...ing, _note: e.target.value } : ing))}
                              placeholder="Hinweis für den Koch …"
                              rows={2}
                              style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                            />
                          )}
                        </div>
                      )
                    })}
                    <button
                      data-track-id="recipe-form-subrecipe-open"
                      onClick={() => { setSubRecipeOpen(o => !o); setSubRecipeQuery(''); setSubRecipeResults([]) }}
                      style={{ width: '100%', padding: '0.625rem 1rem', border: `1.5px solid ${subRecipeOpen ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: 'none', color: subRecipeOpen ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'border-color 0.15s, color 0.15s' }}
                    >
                      {subRecipeOpen ? '✕ Schließen' : '＋ Teilrezept hinzufügen'}
                    </button>
                    {subRecipeOpen && (
                      <div style={{ marginTop: '0.5rem', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', background: 'var(--card)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                        <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                          <input
                            autoFocus
                            value={subRecipeQuery}
                            onChange={e => setSubRecipeQuery(e.target.value)}
                            placeholder="Rezept suchen …"
                            style={{ width: '100%', padding: '0.5rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border-input)' }}
                          />
                        </div>
                        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                          {subRecipeLoading && <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Suche …</div>}
                          {!subRecipeLoading && subRecipeQuery.trim() && subRecipeResults.length === 0 && (
                            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>Keine Ergebnisse</div>
                          )}
                          {!subRecipeLoading && !subRecipeQuery.trim() && (
                            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Rezeptname eingeben …</div>
                          )}
                          {subRecipeResults.map((r, i) => (
                            <button
                              key={r.id}
                              data-track-id="recipe-form-subrecipe-select"
                              onClick={() => {
                                setIngredients(prev => {
                                  if (prev.some(ing => ing._module_recipe_id === r.id)) return prev
                                  const authorLabel = r.created_by === user?.id ? 'Eigenes Rezept' : (r.author ? `von ${r.author.display_name || r.author.username}` : '')
                                  return [...prev, { _key: `mod_${r.id}_${Date.now()}`, component_label: r.title, name: r.title, amount: '', unit: '', is_integer: false, _auto_int: false, _module_recipe_id: r.id, _module_component_id: null, _servings_override: r.servings ? String(r.servings) : '', _scale_factor: '', _module_is_new: true, _author_label: authorLabel }]
                                })
                                markDirty()
                                setSubRecipeOpen(false)
                                setSubRecipeQuery('')
                                setSubRecipeResults([])
                              }}
                              style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.06)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                            >
                              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text)' }}>{r.title}</span>
                              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--subtext)', flexShrink: 0 }}>
                                {r.created_by === user?.id ? 'Eigenes Rezept' : (r.author ? `von ${r.author.display_name || r.author.username}` : '')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ flex: '0 0 220px', minWidth: 0, background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1rem' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.625rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                    ✦ So wird's gespeichert · {parsedA.length} Zutaten
                  </div>
                  {parsedA.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', margin: 0 }}>Noch keine Zutaten …</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {parsedA.map((ing, i) => {
                        const prev = i > 0 ? parsedA[i - 1] : null
                        const showLabel = ing.component_label && ing.component_label !== (prev?.component_label ?? '')
                        return (
                          <li key={i}>
                            {showLabel && (
                              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: i > 0 ? '0.5rem' : 0, marginBottom: '0.2rem' }}>
                                {ing.component_label}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', color: 'var(--text)', paddingBottom: '0.2rem' }}>
                              {(ing.amount || ing.unit) && (
                                <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0, minWidth: '2.5rem' }}>
                                  {[ing.amount, ing.unit].filter(Boolean).join(' ')}
                                </span>
                              )}
                              <span>{ing.name}</span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {ingredients.filter(i => i._module_recipe_id).length > 0 && (
                    <div style={{ marginTop: '0.625rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Teilrezepte</div>
                      {ingredients.filter(i => i._module_recipe_id).map(mod => (
                        <div key={mod._key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', color: 'var(--text)', paddingBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>🔗</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.name}</span>
                          <button onClick={() => { setIngredients(prev => prev.filter(i => i._key !== mod._key)); markDirty() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.8rem', padding: 0, flexShrink: 0, lineHeight: 1 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Anordnung */}
          {wizardStep === 2 && (
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Anordnung</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginBottom: '1.5rem' }}>Ziehe die Blöcke in die gewünschte Reihenfolge.</p>
              {moduleOrder.length === 0 ? (
                <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>Keine Teilrezepte eingebunden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '520px' }}>
                  {moduleOrder.map((id, idx) => {
                    const isMain = id === 'main'
                    const mod = isMain ? null : ingredients.find(i => i._key === id)
                    const name = isMain ? (title || 'Hauptrezept') : (mod?.name || '—')
                    const authorLabel = isMain ? (user?.display_name || user?.username || 'Eigenes Rezept') : (mod?._author_label || '')
                    const portionen = isMain ? servingsNum : (parseInt(mod?._servings_override) || servingsNum)
                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={() => { dragFromRef.current = idx }}
                        onDragOver={e => {
                          e.preventDefault()
                          if (dragFromRef.current === null || dragFromRef.current === idx) return
                          const from = dragFromRef.current
                          setModuleOrder(prev => {
                            const arr = [...prev]
                            const [item] = arr.splice(from, 1)
                            arr.splice(idx, 0, item)
                            return arr
                          })
                          dragFromRef.current = idx
                        }}
                        onDragEnd={() => { dragFromRef.current = null }}
                        data-track-id="recipe-form-anordnung-drag"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', cursor: 'grab', userSelect: 'none' }}
                      >
                        <span style={{ fontSize: '1.1rem', color: 'var(--subtext)', flexShrink: 0, lineHeight: 1 }}>⠿</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {authorLabel && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--subtext)', marginBottom: '0.1rem' }}>{authorLabel}</div>}
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        </div>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--subtext)', flexShrink: 0, whiteSpace: 'nowrap' }}>{portionen} Portionen</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Zubereitung */}
          {wizardStep === 3 && (
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Zubereitung</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginBottom: '1.5rem' }}>Beschreibe die Schritte. Timer und Fotos auf Wunsch.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {steps.map((step, idx) => {
                  const firstLine = (step.instruction || '').split('\n')[0] || ''
                  const stepTitle = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '').trim() : ''
                  const timerLabel = stepTitle || `Schritt ${idx + 1}`
                  const timerActive = !!step.timer_minutes
                  const fotoActive = (step.media?.length > 0)
                  const instrLower = (step.instruction || '').toLowerCase()
                  const updStep = changes => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...changes } : s))
                  const ING_PREVIEW = 5
                  const hasMoreIngs = realIngs.length > ING_PREVIEW
                  const visibleIngs = (step._ings_expanded || !hasMoreIngs) ? realIngs : realIngs.slice(0, ING_PREVIEW)
                  return (
                    <div
                      key={step._key}
                      draggable
                      onDragStart={() => { dragFromRef.current = idx }}
                      onDragOver={e => {
                        e.preventDefault()
                        if (dragFromRef.current === null || dragFromRef.current === idx) return
                        const from = dragFromRef.current
                        setSteps(prev => {
                          const arr = [...prev]
                          const [item] = arr.splice(from, 1)
                          arr.splice(idx, 0, item)
                          return arr
                        })
                        dragFromRef.current = idx
                      }}
                      onDragEnd={() => { dragFromRef.current = null }}
                      data-track-id="recipe-form-step-drag"
                      style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem', background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', cursor: 'grab', userSelect: 'none' }}
                    >
                      <span style={{ fontSize: '1.1rem', color: 'var(--subtext)', flexShrink: 0, lineHeight: 1.8, cursor: 'grab' }}>⠿</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header: number + title + remove */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>{idx + 1}</div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            {stepTitle && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepTitle}</span>}
                          </div>
                          <button onClick={() => { setSteps(prev => prev.filter((_, i) => i !== idx)); markDirty() }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
                        </div>
                        {/* Textarea with # bold overlay */}
                        <div style={{ position: 'relative' }}>
                          {stepTitle && (
                            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', boxSizing: 'border-box', borderRadius: 'var(--radius-input)' }}>
                              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{firstLine}</span>
                              <span style={{ color: 'var(--text)' }}>{(step.instruction || '').slice(firstLine.length)}</span>
                            </div>
                          )}
                          <textarea
                            data-track-id="recipe-form-step-instruction"
                            value={step.instruction}
                            onChange={e => { updStep({ instruction: e.target.value }); markDirty() }}
                            placeholder={'# Schrittname (optional)\nSchritt beschreiben …'}
                            rows={Math.max(3, (step.instruction || '').split('\n').length + 1)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: stepTitle ? 'transparent' : 'var(--text)', caretColor: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.6, cursor: 'text' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,96,42,0.12)' }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
                          />
                        </div>
                        {/* Zutaten immer sichtbar, ausklappbar */}
                        {realIngs.length > 0 && (
                          <div style={{ marginTop: '0.625rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {visibleIngs.map(ing => {
                                const manualSel = (step._ing_keys || []).includes(ing._key)
                                const blocked = (step._ing_blocked || []).includes(ing._key)
                                const autoSel = !blocked && instrLower.includes(ing.name.toLowerCase())
                                const active = manualSel || autoSel
                                const ingLabel = [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')
                                return (
                                  <button
                                    key={`${ing._key}-${autoSel}-${blocked}`}
                                    data-track-id="recipe-form-step-ing-toggle"
                                    onClick={() => {
                                      if (active) {
                                        if (manualSel) {
                                          updStep({ _ing_keys: (step._ing_keys || []).filter(k => k !== ing._key) })
                                        } else {
                                          updStep({ _ing_blocked: [...(step._ing_blocked || []), ing._key] })
                                        }
                                      } else {
                                        if (blocked) {
                                          updStep({ _ing_blocked: (step._ing_blocked || []).filter(k => k !== ing._key) })
                                        } else {
                                          updStep({ _ing_keys: [...(step._ing_keys || []), ing._key] })
                                        }
                                      }
                                      markDirty()
                                    }}
                                    style={{ padding: '0.15rem 0.5rem', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: active ? 'rgba(200,96,42,0.1)' : 'none', color: active ? 'var(--accent)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', cursor: 'pointer', animation: autoSel && !manualSel ? 'ing-highlight 0.5s ease' : 'none' }}>
                                    {ingLabel}
                                  </button>
                                )
                              })}
                              {hasMoreIngs && (
                                <button
                                  onClick={() => updStep({ _ings_expanded: !step._ings_expanded })}
                                  style={{ padding: '0.15rem 0.5rem', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'none', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', cursor: 'pointer' }}>
                                  {step._ings_expanded ? '↑ weniger' : `+ ${realIngs.length - ING_PREVIEW} mehr`}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Compact action pills: Timer + Foto */}
                        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            data-track-id="recipe-form-step-timer-toggle"
                            onClick={() => updStep({ _open_timer: !step._open_timer, _open_foto: false })}
                            style={{ padding: '0.15rem 0.5rem', border: `1px solid ${timerActive || step._open_timer ? 'var(--text)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: timerActive || step._open_timer ? 'rgba(44,44,42,0.07)' : 'none', color: timerActive || step._open_timer ? 'var(--text)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', cursor: 'pointer' }}>
                            {timerActive ? `⏱ ${step.timer_minutes} Min.` : '⏱ Timer'}
                          </button>
                          <button
                            data-track-id="recipe-form-step-foto-toggle"
                            onClick={() => updStep({ _open_foto: !step._open_foto, _open_timer: false })}
                            style={{ padding: '0.15rem 0.5rem', border: `1px solid ${fotoActive || step._open_foto ? 'var(--text)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: fotoActive || step._open_foto ? 'rgba(44,44,42,0.07)' : 'none', color: fotoActive || step._open_foto ? 'var(--text)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', cursor: 'pointer' }}>
                            {fotoActive ? `📷 ${step.media.length}` : '📷 Foto'}
                          </button>
                        </div>
                        {/* Timer panel */}
                        {step._open_timer && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-input)', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--subtext)', flexShrink: 0 }}>⏱ {timerLabel}</span>
                            <input
                              type="number" min="1"
                              value={step.timer_minutes}
                              onChange={e => { updStep({ timer_minutes: e.target.value }); markDirty() }}
                              placeholder="—"
                              style={{ width: '64px', padding: '0.25rem 0.5rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', textAlign: 'right', cursor: 'text' }}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border-input)' }}
                            />
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--subtext)' }}>Minuten</span>
                            {step.timer_minutes && (
                              <button onClick={() => { updStep({ timer_minutes: '' }); markDirty() }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', padding: '0 2px', lineHeight: 1, marginLeft: 'auto' }}>Entfernen</button>
                            )}
                          </div>
                        )}
                        {/* Foto panel */}
                        {step._open_foto && (
                          <div style={{ marginTop: '0.5rem' }}>
                            {step.dbId ? (
                              <MediaUpload
                                entityType="step"
                                entityId={step.dbId}
                                existingMedia={step.media || []}
                                onMediaChange={media => updateStepMedia(step._key, media)}
                                allowVideo={false}
                              />
                            ) : (
                              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--subtext)', fontStyle: 'italic', margin: 0, padding: '0.375rem 0' }}>
                                Erst speichern, um ein Foto hochzuladen.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <button
                data-track-id="recipe-form-step-add"
                onClick={() => { setSteps(prev => [...prev, mkStep()]); markDirty() }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', border: 'none', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500 }}
              >
                + Schritt hinzufügen
              </button>
            </div>
          )}

          {/* Step 4: Feinschliff */}
          {wizardStep === 4 && (
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>Feinschliff</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginBottom: '1.75rem' }}>Letzte Details — dann ist dein Rezept fertig.</p>

              {/* 1. Zeiten + Portionen */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', color: 'var(--subtext)', marginBottom: '0.625rem', textTransform: 'uppercase' }}>Zeiten &amp; Portionen</div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 7rem' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--subtext)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Vorbereitung</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input type="number" min="0" value={prepTime} onChange={e => { setPrepTime(e.target.value); markDirty() }} placeholder="—"
                        style={{ width: '4.5rem', padding: '0.4rem 0.5rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-input)' }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--subtext)' }}>Min.</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 9rem' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--subtext)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Zubereitungszeit</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input type="number" min="0" value={cookTime} onChange={e => { setCookTime(e.target.value); markDirty() }} placeholder="—"
                        style={{ width: '4.5rem', padding: '0.4rem 0.5rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-input)' }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--subtext)' }}>Min.</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 7rem' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--subtext)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Portionen</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <button data-track-id="recipe-form-servings-dec"
                        onClick={() => { setServings(String(Math.max(1, (parseInt(servings) || 4) - 1))); markDirty() }}
                        style={{ width: '2rem', height: '2rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                      <span style={{ minWidth: '1.75rem', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{servings || '4'}</span>
                      <button data-track-id="recipe-form-servings-inc"
                        onClick={() => { setServings(String((parseInt(servings) || 4) + 1)); markDirty() }}
                        style={{ width: '2rem', height: '2rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Art */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', color: 'var(--subtext)', marginBottom: '0.625rem', textTransform: 'uppercase' }}>Art</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[['kochen', 'Kochen'], ['backen', 'Backen'], ['grillen', 'Grillen'], ['einmachen', 'Einmachen']].map(([value, label]) => (
                    <button key={value} data-track-id={`recipe-form-type-${value}`}
                      onClick={() => { setType(value); markDirty() }}
                      style={{ padding: '0.4rem 1rem', border: `1.5px solid ${type === value ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: type === value ? 'var(--accent)' : 'none', color: type === value ? '#fff' : 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: type === value ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Schwierigkeit */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.625rem' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', color: 'var(--subtext)', textTransform: 'uppercase' }}>Schwierigkeit</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--subtext)' }}>· {['Sehr einfach', 'Einfach', 'Mittel', 'Schwer', 'Sehr schwer'][difficulty - 1]}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} data-track-id={`recipe-form-difficulty-${n}`}
                      title={['Sehr einfach', 'Einfach', 'Mittel', 'Schwer', 'Sehr schwer'][n - 1]}
                      onClick={() => { setDifficulty(n); markDirty() }}
                      style={{ width: '2.25rem', height: '2.25rem', border: `1.5px solid ${n <= difficulty ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: '5px', background: n <= difficulty ? 'var(--accent)' : 'none', cursor: 'pointer', flexShrink: 0 }} />
                  ))}
                </div>
              </div>

              {/* 4. Fotos */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', color: 'var(--subtext)', marginBottom: '0.625rem', textTransform: 'uppercase' }}>Fotos</div>
                {recipeId ? (
                  <MediaUpload
                    entityType="recipe"
                    entityId={recipeId}
                    existingMedia={recipeMedia}
                    onMediaChange={setRecipeMedia}
                  />
                ) : (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--subtext)', fontStyle: 'italic', margin: 0 }}>
                    Erst speichern, um Fotos hochzuladen.
                  </p>
                )}
              </div>

              {/* 5. Dazu servieren */}
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', color: 'var(--subtext)', marginBottom: '0.625rem', textTransform: 'uppercase' }}>Dazu servieren</div>
                {serveWith.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    {serveWith.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.5rem 0.3rem 0.75rem', background: 'var(--card)', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text)' }}>
                        {r.title}
                        <button onClick={() => setServeWith(prev => prev.filter(x => x.id !== r.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {!serveWithOpen ? (
                  <button data-track-id="recipe-form-servewith-open"
                    onClick={() => setServeWithOpen(true)}
                    style={{ padding: '0.4rem 0.875rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                    + Gericht suchen …
                  </button>
                ) : (
                  <div style={{ border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                    <input
                      autoFocus
                      data-track-id="recipe-form-servewith-input"
                      value={serveWithQuery}
                      onChange={e => setServeWithQuery(e.target.value)}
                      placeholder="Rezept suchen …"
                      style={{ width: '100%', padding: '0.625rem 1rem', border: 'none', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {serveWithLoading && (
                      <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Suche …</div>
                    )}
                    {!serveWithLoading && serveWithQuery.trim() && serveWithResults.length === 0 && (
                      <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Keine Treffer.</div>
                    )}
                    {serveWithResults.filter(r => !serveWith.find(x => x.id === r.id)).map(r => (
                      <button key={r.id} data-track-id="recipe-form-servewith-select"
                        onClick={() => { setServeWith(prev => [...prev, { id: r.id, title: r.title }]); setServeWithOpen(false); setServeWithQuery(''); setServeWithResults([]) }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', border: 'none', borderTop: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', textAlign: 'left' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {r.title}
                      </button>
                    ))}
                    <button data-track-id="recipe-form-servewith-close"
                      onClick={() => { setServeWithOpen(false); setServeWithQuery(''); setServeWithResults([]) }}
                      style={{ display: 'block', width: '100%', padding: '0.4rem 1rem', border: 'none', borderTop: '1px solid var(--border)', background: 'none', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', textAlign: 'left' }}>
                      Schließen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Wizard footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card)', boxShadow: '0 -2px 12px rgba(0,0,0,0.1)', zIndex: 200 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.625rem' }}>
          <div>
            {wizardStep > 0 && (
              <button
                data-track-id="recipe-form-step-back"
                onClick={() => setWizardStep(s => { const prev = s - 1; return prev === 2 && noModules ? 1 : prev })}
                style={{ padding: '0.625rem 1rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', flexShrink: 0 }}>
                ← Zurück
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <button
              data-track-id="recipe-form-preview"
              onClick={() => recipeId && window.open(`/recipes/${recipeId}`, '_blank')}
              disabled={!recipeId}
              style={{ padding: '0.625rem 1rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: recipeId ? 'var(--text)' : 'var(--border-input)', cursor: recipeId ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', flexShrink: 0 }}>
              Vorschau
            </button>
            {wizardStep < STEPS.length - 1 ? (
              <button onClick={() => setWizardStep(s => { const next = s + 1; return next === 2 && noModules ? 3 : next })} data-track-id="recipe-form-step-next"
                style={{ padding: '0.625rem 1.125rem', border: 'none', borderRadius: 'var(--radius-input)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>
                Weiter →
              </button>
            ) : (
              <button onClick={handleSave} data-track-id="recipe-form-submit"
                disabled={!!savingAs || !title.trim() || !isDirty}
                style={{ padding: '0.625rem 1.125rem', border: 'none', borderRadius: 'var(--radius-input)', background: (savingAs || !title.trim() || !isDirty) ? 'var(--border-input)' : 'var(--accent)', color: '#fff', cursor: (savingAs || !title.trim() || !isDirty) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>
                {savingAs ? 'Speichert …' : 'Speichern'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save toast */}
      {toast && (
        <>
          <style>{`
            @keyframes toast-in  { from{opacity:0} to{opacity:1} }
            @keyframes toast-out { from{opacity:1} to{opacity:0} }
          `}</style>
          <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(44,44,42,0.92)',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '0.9rem',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            animation: toastFading ? 'toast-out 0.3s ease forwards' : 'toast-in 0.2s ease',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {toast}
          </div>
        </>
      )}
    </div>
  )
}
