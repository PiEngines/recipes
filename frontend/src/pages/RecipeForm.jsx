import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import MediaUpload from '../components/MediaUpload'
import Breadcrumb from '../components/Breadcrumb'
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
  const [status, setStatus] = useState('draft')
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

  const savingRef = useRef(false)
  const stateRef = useRef({})

  useEffect(() => {
    stateRef.current = {
      title, description, prepTime, cookTime, servings,
      difficulty, source, status, type,
      selectedCats, selectedTags,
      ingredients, steps,
      recipeId,
    }
  })

  const markDirty = useCallback(() => setIsDirty(true), [])

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
    setStatus(snap.status)
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
          status: r.status,
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
  const buildPayload = useCallback((targetStatus) => {
    const s = stateRef.current
    return {
      title: s.title,
      description: s.description || null,
      prep_time: s.prepTime !== '' ? parseInt(s.prepTime) : null,
      cook_time: s.cookTime !== '' ? parseInt(s.cookTime) : null,
      servings: s.servings !== '' ? parseInt(s.servings) : null,
      difficulty: s.difficulty || null,
      status: targetStatus ?? s.status,
      type: s.type,
      source: s.source || null,
      category_ids: s.selectedCats.map(c => c.id),
      tag_ids: s.selectedTags.map(t => t.id),
      ingredients: (() => {
        let curLabel = null, curIsModule = false
        return s.ingredients
          .filter(i => {
            if (i.component_label !== curLabel) { curLabel = i.component_label; curIsModule = !!i._module_recipe_id }
            return i.name.trim() && !curIsModule
          })
          .map((i, idx) => ({ component_label: i.component_label || null, name: i.name.trim(), amount: i.amount || null, unit: i.unit || null, sort_order: idx, is_integer: i.is_integer ?? false }))
      })(),
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
    setSavingAs(targetStatus ?? s.status)
    setSaveError(null)
    try {
      const payload = buildPayload(targetStatus)
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
      if (targetStatus) { setStatus(targetStatus); stateRef.current.status = targetStatus }
      setSavedAt(new Date())
      setIsDirty(false)
      if (targetStatus) {
        const wasPublished = s.status === 'published'
        const toastMsg = targetStatus === 'draft'
          ? (wasPublished ? 'Rezept zurückgezogen' : 'Als Entwurf gespeichert')
          : (wasPublished ? 'Änderungen gespeichert' : 'Veröffentlicht')
        setToast(toastMsg)
      }
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
  const handleSaveAndMaybeReview = useCallback(async (targetStatus) => {
    const wasNew = !stateRef.current.recipeId
    const capturedIngs = [...stateRef.current.ingredients]
    const prevNames = new Set(
      capturedIngs.filter(i => i.name.trim()).map(i => i.name.trim().toLowerCase())
    )
    const data = await doSave(targetStatus)
    if (!data) return

    let curLabel = null
    for (const ing of capturedIngs) {
      if (ing.component_label !== curLabel) {
        curLabel = ing.component_label
        if (ing._module_recipe_id && ing._module_is_new) {
          try {
            await client.post(`/api/recipes/${data.id}/components`, {
              child_recipe_id: ing._module_recipe_id,
              sort_order: 0,
              servings_override: ing._servings_override ? parseInt(ing._servings_override) || null : null,
              scale_factor: ing._scale_factor ? parseFloat(ing._scale_factor) || null : null,
            })
          } catch {
            setToast('Ein Modul konnte nicht eingebunden werden.')
          }
        }
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

  const handleDraft = async () => { if (savingRef.current || !title.trim()) return; await handleSaveAndMaybeReview('draft') }
  const handlePublish = async () => { if (savingRef.current || !title.trim()) return; await handleSaveAndMaybeReview('published') }

  const handleReviewClick = () => {
    if (!recipeId) return
    if (isDirty) setShowReviewDialog(true)
    else navigate(`/recipes/${recipeId}/review`)
  }

  const handleReviewSaveAndGo = async () => {
    setShowReviewDialog(false)
    if (savingRef.current || !title.trim()) return
    const data = await doSave(undefined)
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '96px' }}>

      {/* Breadcrumb strip */}
      <div style={{ padding: '0 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Breadcrumb items={isEdit
          ? [{ label: 'Alle Rezepte', path: '/' }, { label: title || 'Rezept', path: recipeId ? `/recipes/${recipeId}` : null }, { label: 'Bearbeiten', path: null }]
          : [{ label: 'Alle Rezepte', path: '/' }, { label: 'Neues Rezept', path: null }]
        } />
      </div>

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

      {/* Sticky top bar */}
      <header style={{ position: 'sticky', top: '64px', zIndex: 50, background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => guardedNavigate(recipeId ? `/recipes/${recipeId}` : '/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.9rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ← {isEdit ? 'Zur Detailseite' : 'Übersicht'}
          </button>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {isEdit ? (title || 'Rezept bearbeiten') : 'Neues Rezept'}
          </h1>
          {saveStatusText && (
            <span style={{ fontSize: '0.78rem', color: saveStatusColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{saveStatusText}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* 1. Grunddaten */}
        <SectionCard title="Grunddaten" icon="📋">
          <div style={{ marginBottom: '1.25rem' }}>
            <FieldLabel required>Titel</FieldLabel>
            <StyledInput value={title} onChange={v => { setTitle(v); markDirty() }} placeholder="Rezepttitel …" autoFocus={!isEdit} />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <FieldLabel>Beschreibung</FieldLabel>
            <StyledTextarea value={description} onChange={v => { setDescription(v); markDirty() }} placeholder="Kurze Beschreibung des Rezepts …" rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: '1.25rem' }}>
            <div><FieldLabel>Vorbereitung (min)</FieldLabel><StyledInput type="number" min="0" value={prepTime} onChange={v => { setPrepTime(v); markDirty() }} placeholder="z.B. 15" /></div>
            <div><FieldLabel>Kochzeit (min)</FieldLabel><StyledInput type="number" min="0" value={cookTime} onChange={v => { setCookTime(v); markDirty() }} placeholder="z.B. 30" /></div>
            <div><FieldLabel>Portionen</FieldLabel><StyledInput type="number" min="1" value={servings} onChange={v => { setServings(v); markDirty() }} placeholder="z.B. 4" /></div>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <FieldLabel>Schwierigkeit</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.375rem' }}>
              <input type="range" min="1" max="5" value={difficulty} onChange={e => { setDifficulty(parseInt(e.target.value)); markDirty() }} style={{ flex: 1, accentColor: diffColor(difficulty) }} />
              <span style={{ minWidth: '2.5rem', textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: diffColor(difficulty) }}>{difficulty}/5</span>
            </div>
            <span style={{ display: 'inline-flex', gap: '2px' }} title={`${difficulty}/5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ display: 'inline-block', fontSize: '1.1rem', color: '#C8602A', opacity: i < difficulty ? 1 : 0.2, lineHeight: 1, transform: 'scaleX(-1)' }}>🥄</span>
              ))}
            </span>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <FieldLabel required>Art</FieldLabel>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {[['kochen', 'Kochen'], ['backen', 'Backen']].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setType(value); markDirty() }}
                  style={{
                    padding: '0.5rem 1.25rem',
                    border: `1.5px solid ${type === value ? '#C8602A' : 'var(--border-input)'}`,
                    borderRadius: 'var(--radius-pill)',
                    background: type === value ? '#C8602A' : 'var(--card)',
                    color: type === value ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    transition: 'var(--transition)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><FieldLabel>Quelle / Inspiration</FieldLabel><StyledInput value={source} onChange={v => { setSource(v); markDirty() }} placeholder="Buch, Website, Oma …" /></div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <button onClick={() => { setStatus(s => s === 'draft' ? 'published' : 'draft'); markDirty() }} style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${status === 'published' ? 'var(--secondary)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: status === 'published' ? 'rgba(107,124,78,0.08)' : 'transparent', color: status === 'published' ? 'var(--secondary)' : 'var(--subtext)', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500, textAlign: 'left', transition: 'var(--transition)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: status === 'published' ? 'var(--secondary)' : 'var(--border-input)', display: 'inline-block', flexShrink: 0 }} />
                {status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* 2. Kategorien & Tags */}
        <SectionCard title="Kategorien & Tags" icon="🏷️">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <TaxonomyField label="Kategorien" apiPath="/api/categories" selected={selectedCats} onAdd={cat => { setSelectedCats(prev => prev.some(c => c.id === cat.id) ? prev : [...prev, cat]); markDirty() }} onRemove={catId => { setSelectedCats(prev => prev.filter(c => c.id !== catId)); markDirty() }} placeholder="Kategorie suchen oder erstellen …" />
            <TaxonomyField label="Tags" apiPath="/api/tags" selected={selectedTags} onAdd={tag => { setSelectedTags(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag]); markDirty() }} onRemove={tagId => { setSelectedTags(prev => prev.filter(t => t.id !== tagId)); markDirty() }} placeholder="Tag suchen oder erstellen …" />
          </div>
        </SectionCard>

        {/* 3. Zutaten */}
        <SectionCard title="Zutaten" icon="🥕">
          {groupIngsByLabel(ingredients).map(group => {
            const firstIng = group.items[0]
            const firstIdx = ingredients.findIndex(i => i._key === firstIng._key)
            const isModule = !!firstIng._module_recipe_id
            const srch = moduleSearch[firstIng._key] || {}

            return (
              <div key={firstIng._key} style={{ marginBottom: '0.75rem', ...(isModule ? { borderLeft: '3px solid #C8602A', paddingLeft: '0.75rem', borderRadius: '0 var(--radius-input) var(--radius-input) 0' } : {}) }}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SmallInput
                      value={group.label}
                      onChange={v => {
                        const oldLabel = firstIng.component_label
                        const firstKey = firstIng._key
                        setIngredients(prev => {
                          const arr = [...prev]
                          const si = arr.findIndex(x => x._key === firstKey)
                          if (si < 0) return arr
                          for (let i = si; i < arr.length; i++) {
                            if (i > si && arr[i].component_label !== oldLabel) break
                            arr[i] = { ...arr[i], component_label: v }
                          }
                          return arr
                        })
                        markDirty()
                      }}
                      placeholder="Gruppe (optional)"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (isModule) {
                        if (firstIng._module_component_id) {
                          client.delete(`/api/recipes/${recipeId}/components/${firstIng._module_component_id}`)
                            .catch(() => setToast('Modul konnte nicht entfernt werden.'))
                        }
                        setIngredients(prev => prev.map((it, i) => i === firstIdx ? { ...it, _module_recipe_id: null, _module_component_id: null, _servings_override: '', _scale_factor: '', _module_is_new: false } : it))
                        markDirty()
                      } else if (srch.open) {
                        setModuleSearch(prev => { const n = { ...prev }; delete n[firstIng._key]; return n })
                      } else {
                        setModuleSearch(prev => ({ ...prev, [firstIng._key]: { query: '', results: [], open: true, loading: false } }))
                      }
                    }}
                    style={{ padding: '0.25rem 0.625rem', border: `1.5px solid ${isModule ? '#C8602A' : (srch.open ? 'var(--accent)' : 'var(--border-input)')}`, borderRadius: 'var(--radius-pill)', background: isModule ? 'rgba(200,96,42,0.1)' : 'none', color: isModule ? '#C8602A' : (srch.open ? 'var(--accent)' : 'var(--subtext)'), cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', flexShrink: 0, transition: 'var(--transition)' }}
                  >
                    {isModule ? '🔗 Modul' : (srch.open ? '✕ Schließen' : 'Als Modul')}
                  </button>
                  {!isModule && (
                    <button
                      data-track-id="form-ingredient-group-extract"
                      onClick={() => {
                        if (!recipeId) return
                        setExtractDialog({ firstKey: firstIng._key, label: group.label, title: group.label || 'Neue Zubereitung' })
                      }}
                      disabled={!recipeId}
                      title={!recipeId ? 'Speichere das Rezept zuerst' : 'Als eigenes Rezept auslagern'}
                      style={{ padding: '0.25rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-pill)', background: 'none', color: recipeId ? 'var(--subtext)' : 'var(--border-input)', cursor: recipeId ? 'pointer' : 'not-allowed', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', flexShrink: 0, transition: 'var(--transition)' }}
                    >
                      Auslagern
                    </button>
                  )}
                </div>

                {/* Module settings (when already linked) */}
                {isModule && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <input
                      type="number" min="1"
                      value={firstIng._servings_override}
                      onChange={e => { setIngredients(prev => prev.map((it, i) => i === firstIdx ? { ...it, _servings_override: e.target.value } : it)); markDirty() }}
                      placeholder="Portionen-Override"
                      style={{ flex: 1, padding: '0.45rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }}
                    />
                    <input
                      type="number" min="0.1" max="10" step="0.1"
                      value={firstIng._scale_factor}
                      onChange={e => { setIngredients(prev => prev.map((it, i) => i === firstIdx ? { ...it, _scale_factor: e.target.value } : it)); markDirty() }}
                      placeholder="Skalierungsfaktor"
                      style={{ flex: 1, padding: '0.45rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }}
                    />
                  </div>
                )}

                {/* Module search (when toggled, not yet linked) */}
                {!isModule && srch.open && (
                  <div style={{ marginBottom: '0.35rem', position: 'relative' }}>
                    <SmallInput
                      value={srch.query || ''}
                      onChange={v => {
                        const key = firstIng._key
                        setModuleSearch(prev => ({ ...prev, [key]: { ...prev[key], query: v } }))
                        clearTimeout(moduleSearchTimers.current[key])
                        if (!v.trim()) {
                          setModuleSearch(prev => ({ ...prev, [key]: { ...prev[key], results: [], loading: false } }))
                          return
                        }
                        setModuleSearch(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }))
                        moduleSearchTimers.current[key] = setTimeout(async () => {
                          try {
                            const res = await client.get('/api/recipes', { params: { as_module: true, search: v.trim(), search_scope: 'title', page_size: 8 } })
                            setModuleSearch(prev => ({ ...prev, [key]: { ...prev[key], results: res.data.items || [], loading: false } }))
                          } catch {
                            setModuleSearch(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }))
                          }
                        }, 300)
                      }}
                      placeholder="Modul-Rezept suchen …"
                    />
                    {(srch.loading || (srch.results || []).length > 0 || (srch.query && !srch.loading)) && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1.5px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 var(--radius-input) var(--radius-input)', boxShadow: 'var(--shadow-hover)', zIndex: 100, maxHeight: '180px', overflowY: 'auto' }}>
                        {srch.loading && <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--subtext)' }}>Suche …</div>}
                        {(srch.results || []).map((r, ri) => (
                          <button
                            key={r.id}
                            onMouseDown={e => {
                              e.preventDefault()
                              const oldLabel = group.label
                              const firstKey = firstIng._key
                              setIngredients(prev => {
                                const arr = [...prev]
                                const si = arr.findIndex(x => x._key === firstKey)
                                if (si < 0) return arr
                                for (let i = si; i < arr.length; i++) {
                                  if (i > si && arr[i].component_label !== oldLabel) break
                                  arr[i] = { ...arr[i], component_label: r.title }
                                  if (i === si) arr[i] = { ...arr[i], _module_recipe_id: r.id, _module_component_id: null, _module_is_new: true }
                                }
                                return arr
                              })
                              setModuleSearch(prev => { const n = { ...prev }; delete n[firstKey]; return n })
                              markDirty()
                            }}
                            style={{ width: '100%', padding: '0.4rem 0.75rem', background: 'none', border: 'none', borderTop: ri > 0 ? '1px solid var(--border)' : 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.06)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                          >
                            <span>{r.title}</span>
                            {r.servings && <span style={{ color: 'var(--subtext)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{r.servings} Port.</span>}
                          </button>
                        ))}
                        {!srch.loading && srch.query && !(srch.results || []).length && (
                          <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--subtext)' }}>Keine Ergebnisse</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Ingredient rows */}
                {group.items.map(ing => {
                  const idx = ingredients.findIndex(i => i._key === ing._key)
                  return (
                    <IngredientRow
                      key={ing._key}
                      item={ing}
                      index={idx}
                      total={ingredients.length}
                      hideLabel
                      onChange={(field, val) => { setIngredients(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it)); markDirty() }}
                      onMove={dir => { setIngredients(prev => { const arr = [...prev]; const t = idx + dir; if (t < 0 || t >= arr.length) return arr; ;[arr[idx], arr[t]] = [arr[t], arr[idx]]; return arr }); markDirty() }}
                      onRemove={() => { setIngredients(prev => prev.filter((_, i) => i !== idx)); markDirty() }}
                    />
                  )
                })}
              </div>
            )
          })}
          <AddRowBtn onClick={() => { setIngredients(prev => [...prev, mkIng()]); markDirty() }}>+ Zutat hinzufügen</AddRowBtn>
        </SectionCard>

        {/* 4. Schritte */}
        <SectionCard title="Zubereitung" icon="👨‍🍳">
          {steps.map((step, idx) => (
            <StepRow key={step._key} item={step} index={idx} total={steps.length}
              onChange={(field, val) => { setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s)); markDirty() }}
              onMove={dir => { setSteps(prev => { const arr = [...prev]; const t = idx + dir; if (t < 0 || t >= arr.length) return arr; ;[arr[idx], arr[t]] = [arr[t], arr[idx]]; return arr }); markDirty() }}
              onRemove={() => { setSteps(prev => prev.filter((_, i) => i !== idx)); markDirty() }}
              onMediaChange={media => updateStepMedia(step._key, media)}
              onStepMediaReload={(dbId, key) => reloadStepMedia(dbId, key)}
            />
          ))}
          <AddRowBtn onClick={() => { setSteps(prev => [...prev, mkStep()]); markDirty() }}>+ Schritt hinzufügen</AddRowBtn>
        </SectionCard>

        {/* 5. Fotos & Videos */}
        <SectionCard title="Fotos & Videos" icon="📷">
          {recipeId ? (
            <MediaUpload
              entityType="recipe"
              entityId={recipeId}
              existingMedia={recipeMedia}
              onMediaChange={async () => {
                try {
                  const { data } = await client.get(`/api/media/entity/recipe/${recipeId}`)
                  setRecipeMedia(data)
                } catch {}
              }}
              allowVideo={true}
            />
          ) : (
            <p style={{ color: 'var(--subtext)', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
              Speichere das Rezept zuerst, um Fotos und Videos hochzuladen.
            </p>
          )}
        </SectionCard>
      </main>

      {/* Sticky footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card)', boxShadow: '0 -2px 12px rgba(0,0,0,0.1)', zIndex: 200 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.825rem', color: saveStatusColor, flex: '1 1 auto', minWidth: '100px' }}>
          {saveStatusText || (!title.trim() && <span style={{ color: 'var(--subtext)', fontStyle: 'italic' }}>Titel eingeben zum Speichern</span>)}
        </span>

        {isEdit && (
          <button onClick={handleDiscard} style={{ padding: '0.625rem 1rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'none', color: 'var(--subtext)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Verwerfen
          </button>
        )}

        {isKochOrAbove(user) && (
          <button
            onClick={handleReviewClick}
            disabled={!recipeId}
            title={!recipeId ? 'Erst speichern, um Zutaten zu überprüfen' : undefined}
            style={{ padding: '0.625rem 1rem', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', background: 'none', color: !recipeId ? 'var(--subtext)' : 'var(--accent)', cursor: !recipeId ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, opacity: !recipeId ? 0.5 : 1 }}
          >
            🥕 Zutaten überprüfen
          </button>
        )}

        <button onClick={handleDraft} disabled={!!savingAs || !title.trim() || !isDirty} style={{ padding: '0.625rem 1.25rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: (savingAs || !title.trim() || !isDirty) ? 'var(--subtext)' : 'var(--text)', cursor: (savingAs || !title.trim() || !isDirty) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'var(--transition)', whiteSpace: 'nowrap', flexShrink: 0, opacity: (!title.trim() || !isDirty) ? 0.5 : 1 }}>
          {savingAs === 'draft' ? 'Wird gespeichert …' : status === 'published' ? 'Als Entwurf zurückziehen' : 'Als Entwurf speichern'}
        </button>

        <button onClick={handlePublish} disabled={!!savingAs || !title.trim() || !isDirty} style={{ padding: '0.625rem 1.5rem', border: 'none', borderRadius: 'var(--radius-input)', background: (savingAs || !title.trim() || !isDirty) ? 'var(--border-input)' : 'var(--accent)', color: '#fff', cursor: (savingAs || !title.trim() || !isDirty) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, transition: 'var(--transition)', whiteSpace: 'nowrap', flexShrink: 0, opacity: (!title.trim() || !isDirty) ? 0.5 : 1 }}
          onMouseEnter={e => { if (!savingAs && title.trim() && isDirty) e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { if (!savingAs && title.trim() && isDirty) e.currentTarget.style.background = 'var(--accent)' }}>
          {savingAs === 'published' ? 'Wird gespeichert …' : status === 'published' ? 'Änderungen speichern' : 'Veröffentlichen'}
        </button>
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
