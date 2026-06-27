import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTimerContext } from '../context/TimerContext'
import { useNavigation } from '../context/NavigationContext'
import MediaLightbox from '../components/MediaLightbox'
import Breadcrumb from '../components/Breadcrumb'
import FavoriteHeart from '../components/FavoriteHeart'
import AuthorLink from '../components/AuthorLink'
import { isChefkochOrAbove, isKochOrAbove } from '../utils/roles'

// ── Constants & utilities ─────────────────────────────────────────────────────

const GRADIENTS = [
  'linear-gradient(135deg, #C8602A 0%, #E8A07A 100%)',
  'linear-gradient(135deg, #6B7C4E 0%, #9DB06F 100%)',
  'linear-gradient(135deg, #8B6914 0%, #C8A84B 100%)',
  'linear-gradient(135deg, #5B4A6B 0%, #9B7FAE 100%)',
  'linear-gradient(135deg, #2A6B8B 0%, #4A9BBE 100%)',
]

function diffColor(d) {
  if (d <= 3) return '#6B7C4E'
  if (d <= 6) return '#C8A020'
  return '#C8602A'
}

const EXACT_UNITS = new Set(['tsp', 'tbsp', 'pinch', 'Prise'])

function roundToQuarter(n) {
  return Math.round(n * 4) / 4
}

function fmtScaled(n) {
  if (n <= 0) return '0'
  const whole = Math.floor(n + 0.001)
  const frac = Math.round((n - whole) * 4) / 4
  const fracStr = frac < 0.01 ? '' : frac < 0.4 ? '1/4' : frac < 0.65 ? '1/2' : '3/4'
  if (whole === 0) return fracStr || '0'
  if (!fracStr) return String(whole)
  return `${whole} ${fracStr}`
}

function parseScaledValue(amount, factor) {
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(amount.trim())
  if (frac) return (parseInt(frac[1]) / parseInt(frac[2])) * factor
  const n = parseFloat(amount)
  return isNaN(n) ? null : n * factor
}

function scaleAmount(amount, factor, unit, isInteger) {
  if (!amount || factor === 1) return amount
  if (unit && EXACT_UNITS.has(unit)) return amount
  let n = parseScaledValue(amount, factor)
  if (n === null) return amount
  if (n > 0 && n < 0.25) n = 0.25
  if (isInteger) return String(Math.ceil(n))
  return fmtScaled(roundToQuarter(n))
}

// Would reducing servings by one push any ingredient's scaled amount below the practical minimum?
function wouldDropBelowMin(ingredients, servings, baseServings) {
  if (!baseServings) return false
  const factor = (servings - 1) / baseServings
  return (ingredients || []).some(ing => {
    if (!ing.amount || (ing.unit && EXACT_UNITS.has(ing.unit))) return false
    const n = parseScaledValue(ing.amount, factor)
    return n !== null && n > 0 && n < 0.25
  })
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ── Ingredient fuzzy match ────────────────────────────────────────────────────

function normalizeText(s) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}

function fuzzyMatch(stepText, ingredientName) {
  const text = normalizeText(stepText)
  const tokens = normalizeText(ingredientName).split(/\s+/).filter(t => t.length >= 3)
  if (tokens.length === 0) return false
  return tokens.every(t => text.includes(t))
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHighlightedHtml(text, ingredientName) {
  const escaped = escapeHtml(text)
  const pattern = new RegExp(escapeHtml(ingredientName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return escaped.replace(pattern, m => `<mark class="ingredient-highlight">${m}</mark>`)
}

// ── Difficulty spoons ─────────────────────────────────────────────────────────

function DifficultySpoons({ difficulty }) {
  const filled = difficulty
  return (
    <span title={`${difficulty}/5`} style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ display: 'inline-block', fontSize: '1rem', color: '#C8602A', opacity: i < filled ? 1 : 0.25, lineHeight: 1, transform: 'scaleX(-1)' }}>🥄</span>
      ))}
    </span>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────

function HeroSection({ recipe, media, onImageClick, canEdit, onEdit }) {
  const gradient = GRADIENTS[recipe.id % GRADIENTS.length]
  const images = media
    .filter(m => m.media_type === 'image')
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
  const [activeIdx, setActiveIdx] = useState(0)
  const active = images[activeIdx]

  return (
    <div style={{ margin: '0 0 12px' }} className="md:mx-0">
      {/* Main hero */}
      <div
        onClick={active ? () => onImageClick?.(active.url) : undefined}
        style={{
          borderRadius: 16, overflow: 'hidden', position: 'relative', height: 250,
          marginBottom: images.length > 1 ? 8 : 12,
          background: active ? undefined : gradient,
          cursor: active ? 'zoom-in' : 'default',
        }}
      >
        {active && <div className="card-image-bg" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${active.thumbnail_url || active.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.22) 0%, transparent 35%, rgba(0,0,0,.62) 100%)' }} />
        {/* Mobile breadcrumb + edit overlay */}
        <div className="md:hidden" style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <Link to="/recipes" style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>Rezepte</Link>
            <i className="ti ti-chevron-right" style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Inter, sans-serif' }}>{recipe.title}</span>
          </div>
          {canEdit && (
            <button onClick={onEdit} style={{ border: '1.5px solid rgba(255,255,255,.45)', background: 'rgba(0,0,0,.2)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', color: '#fff', borderRadius: 999, padding: '5px 13px', fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
              <i className="ti ti-pencil" style={{ fontSize: 12 }} /> Bearbeiten
            </button>
          )}
        </div>
        <FavoriteHeart recipeId={recipe.id} recipe={recipe} size={20} outline={false}
          style={{ position: 'absolute', bottom: 18, right: 14, background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, padding: 0 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
          {recipe.description && (
            <div style={{ background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
                {recipe.description}
              </p>
            </div>
          )}
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, fontStyle: 'italic', color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,.4)', lineHeight: 1.2 }}>
            {recipe.title}
          </h1>
        </div>
      </div>

      {/* Gallery strip */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {images.map((img, i) => (
            <div
              key={img.id}
              onClick={e => { e.stopPropagation(); setActiveIdx(i) }}
              style={{
                width: 68, height: 52, flexShrink: 0, borderRadius: 6, cursor: 'pointer',
                backgroundImage: `url(${img.thumbnail_url || img.url})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: `2px solid ${i === activeIdx ? 'var(--accent)' : 'transparent'}`,
                boxSizing: 'border-box',
                transition: 'border-color .15s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Meta bar ──────────────────────────────────────────────────────────────────

function MetaBar({ recipe }) {
  const cols = [
    recipe.prep_time ? { label: 'Vorbereitung', value: `${recipe.prep_time} Min.`, accent: true } : null,
    recipe.cook_time ? { label: 'Kochen', value: `${recipe.cook_time} Min.`, accent: true } : null,
    { label: 'Art', value: recipe.type === 'backen' ? 'Backen' : 'Kochen', accent: false },
    recipe.difficulty ? { label: 'Schwierigkeit', value: recipe.difficulty, isDiff: true } : null,
  ].filter(Boolean)

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '1rem', display: 'flex' }}>
      {cols.map((col, i) => (
        <div key={i} style={{ flex: 1, padding: '12px 4px', textAlign: 'center', borderRight: i < cols.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: col.accent ? 'var(--accent)' : 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 4px', fontFamily: 'Inter, sans-serif' }}>
            {col.label}
          </p>
          {col.isDiff ? (
            <DifficultySpoons difficulty={col.value} />
          ) : (
            <p style={{ fontSize: 14, fontWeight: 600, color: col.accent ? 'var(--accent)' : 'var(--text)', margin: 0, fontFamily: 'Inter, sans-serif' }}>
              {col.value}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function MetaStat({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--subtext)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{icon} {label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function Pill({ children, color }) {
  return (
    <span style={{
      padding: '0.2rem 0.65rem',
      borderRadius: 'var(--radius-pill)',
      fontSize: '0.75rem',
      fontWeight: 500,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>{children}</span>
  )
}

// ── Ingredient list (shared by sidebar + drawer) ──────────────────────────────

function IngredientList({ ingredients, scaleFactor, activeIds, view, selectedIngredient, onSelectIngredient }) {
  const safeIngredients = ingredients || []
  const grouped = {}
  for (const ing of safeIngredients) {
    const key = ing.component_label || ''
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ing)
  }
  const groups = Object.entries(grouped)

  if (safeIngredients.length === 0) {
    return <p style={{ fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', padding: '0.5rem 0' }}>Keine Zutaten angegeben.</p>
  }

  const renderIng = ing => {
    const active = activeIds.has(ing.id)
    const selected = selectedIngredient?.id === ing.id
    const scaled = scaleAmount(ing.amount, scaleFactor, ing.unit, ing.is_integer)
    return (
      <div
        key={ing.id}
        onClick={() => onSelectIngredient?.(selected ? null : { id: ing.id, name: ing.name })}
        style={{
          padding: '0.375rem 0.375rem',
          marginBottom: '1px',
          borderBottom: selected ? 'none' : '1px solid var(--border)',
          display: 'flex',
          gap: '0.5rem',
          transition: 'all 0.15s',
          color: (active || selected) ? 'var(--accent)' : 'var(--text)',
          fontWeight: (active || selected) ? 600 : 400,
          cursor: 'pointer',
          background: selected ? 'rgba(200,96,42,0.08)' : 'transparent',
          borderRadius: selected ? '4px' : 0,
          outline: selected ? '1.5px solid rgba(200,96,42,0.4)' : 'none',
        }}
      >
        {(active || selected) && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>●</span>}
        <span style={{ flex: 1, fontSize: '0.875rem' }}>{ing.name}</span>
        {(scaled || ing.unit) && (
          <span style={{ fontSize: '0.8rem', color: (active || selected) ? 'var(--accent)' : 'var(--subtext)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {scaled}{ing.unit ? ` ${ing.unit}` : ''}
          </span>
        )}
      </div>
    )
  }

  if (view === 'all' || groups.length <= 1) {
    return <div>{safeIngredients.map(renderIng)}</div>
  }

  return (
    <div>
      {groups.map(([label, items]) => (
        <div key={label} style={{ marginBottom: '1rem' }}>
          {label && (
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
              {label}
            </div>
          )}
          {items.map(renderIng)}
        </div>
      ))}
    </div>
  )
}

// ── Ingredient sidebar (desktop) ──────────────────────────────────────────────

const adjBtn = {
  width: '28px', height: '28px', borderRadius: '50%',
  border: '1.5px solid var(--border-input)', background: 'none',
  cursor: 'pointer', fontSize: '1rem', color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
  fontFamily: 'Inter, sans-serif',
}

const adjBtnDisabled = {
  ...adjBtn,
  cursor: 'default',
  opacity: 0.4,
  color: 'var(--subtext)',
}

function IngredientSidebar({ recipe, servings, baseServings, onServingsChange, activeIds, view, onViewChange, selectedIngredient, onSelectIngredient }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
  const minusDisabled = wouldDropBelowMin(recipe.ingredients, servings, baseServings)
  return (
    <aside className="hidden md:block" style={{
      width: '260px',
      flexShrink: 0,
      position: 'sticky',
      top: '72px',
      maxHeight: 'calc(100vh - 88px)',
      overflowY: 'auto',
      background: 'var(--card)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow)',
      padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>Zutaten</h3>
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-input)' }}>
          {['grouped', 'all'].map(v => (
            <button key={v} onClick={() => onViewChange(v)} style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              fontFamily: 'Inter, sans-serif',
              border: 'none',
              cursor: 'pointer',
              background: view === v ? 'var(--accent)' : 'transparent',
              color: view === v ? '#fff' : 'var(--subtext)',
              transition: 'all 0.15s',
            }}>
              {v === 'grouped' ? 'Gruppen' : 'Alle'}
            </button>
          ))}
        </div>
      </div>

      {/* Servings adjuster */}
      {recipe.servings && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', flex: 1 }}>Portionen</span>
          <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} disabled={minusDisabled} style={minusDisabled ? adjBtnDisabled : adjBtn}>−</button>
          <span style={{ fontSize: '1rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>{servings}</span>
          <button onClick={() => onServingsChange(s => s + 1)} style={adjBtn}>+</button>
        </div>
      )}

      {selectedIngredient && (
        <div style={{ marginBottom: '0.75rem', padding: '0.375rem 0.625rem', background: 'rgba(200,96,42,0.08)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 500 }}>Filter: {selectedIngredient.name}</span>
          <button onClick={() => onSelectIngredient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.8rem', padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      <IngredientList
        ingredients={recipe.ingredients}
        scaleFactor={scaleFactor}
        activeIds={activeIds}
        view={view}
        selectedIngredient={selectedIngredient}
        onSelectIngredient={onSelectIngredient}
      />
    </aside>
  )
}

// ── Mobile ingredient panel (left pull-tab + left slide panel) ────────────────

function MobileIngredientPanel({ recipe, servings, baseServings, onServingsChange, activeIds, open, onOpen, onClose, selectedIngredient, onSelectIngredient }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
  const minusDisabled = wouldDropBelowMin(recipe.ingredients, servings, baseServings)
  return (
    <>
      {/* Pull tab */}
      <div
        className="md:hidden"
        onClick={open ? onClose : onOpen}
        data-track-id="detail-ingredient-pull-tab"
        style={{ position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 100, background: 'var(--accent)', borderRadius: '0 10px 10px 0', padding: '14px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
      >
        <i className="ti ti-basket" style={{ fontSize: 18, color: '#fff' }} />
        {activeIds.size > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.22)', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
            {activeIds.size}
          </span>
        )}
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden"
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 190 }}
        />
      )}

      {/* Slide panel */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: '65%', maxWidth: 280,
          background: 'var(--card)', zIndex: 200, overflowY: 'auto',
          transform: open ? 'none' : 'translateX(-100%)',
          transition: 'transform .28s ease',
          padding: '1.25rem 1.25rem 2rem',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,.18)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>Zutaten</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--subtext)', lineHeight: 1 }}>✕</button>
        </div>
        {recipe.servings && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--subtext)', flex: 1 }}>Portionen</span>
            <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} disabled={minusDisabled} style={minusDisabled ? adjBtnDisabled : adjBtn}>−</button>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>{servings}</span>
            <button onClick={() => onServingsChange(s => s + 1)} style={adjBtn}>+</button>
          </div>
        )}
        <IngredientList
          ingredients={recipe.ingredients}
          scaleFactor={scaleFactor}
          activeIds={activeIds}
          view="grouped"
          selectedIngredient={selectedIngredient}
          onSelectIngredient={onSelectIngredient}
        />
      </div>
    </>
  )
}

// ── Suggestion card (Dazu passt auch) ────────────────────────────────────────

const SUGG_GRADIENTS = [
  'linear-gradient(148deg, #A85A28 0%, #6B3510 100%)',
  'linear-gradient(148deg, #3D4F25 0%, #6B7C4E 100%)',
  'linear-gradient(148deg, #B09A3E 0%, #7A6A1A 100%)',
  'linear-gradient(148deg, #6B5A3E 0%, #3E3020 100%)',
]

function SuggestionCard({ recipe, image, onClick }) {
  const src = image?.thumbnail_url || image?.url || null
  const bg = SUGG_GRADIENTS[recipe.id % SUGG_GRADIENTS.length]
  const t = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const timeStr = t ? (t >= 60 ? `${Math.floor(t / 60)} Std.` : `${t} Min.`) : null
  return (
    <div onClick={onClick} data-track-id="detail-suggestion-click"
      style={{ width: 148, flexShrink: 0, background: 'var(--card)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.07)', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ height: 100, backgroundImage: src ? `url(${src})` : undefined, background: src ? undefined : bg, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', margin: '0 0 4px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{recipe.title}</p>
        {timeStr && <span style={{ fontSize: 10, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>{timeStr}</span>}
      </div>
    </div>
  )
}

// ── Step image row with scroll dots ──────────────────────────────────────────

function StepImageRow({ images, onImageClick }) {
  const containerRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const handleScroll = useCallback(() => {
    if (!containerRef.current || images.length <= 1) return
    const el = containerRef.current
    const itemWidth = el.scrollWidth / images.length
    setActiveIdx(Math.min(images.length - 1, Math.round(el.scrollLeft / itemWidth)))
  }, [images.length])

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', width: '100%', minHeight: '180px' }}
      >
        {images.map(m => (
          <img
            key={m.id}
            src={m.url}
            alt=""
            onClick={e => { e.stopPropagation(); onImageClick?.(m.url, images) }}
            style={{ height: '180px', width: 'auto', minWidth: '120px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, cursor: 'zoom-in' }}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
          {images.map((_, i) => (
            <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === activeIdx ? '#C8602A' : 'var(--border-input)', display: 'inline-block', transition: 'background 0.2s', flexShrink: 0 }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────

const StepCard = forwardRef(function StepCard({ step, index, isActive, onClick, onAddTimer, hasActiveTimer, stepImages, onImageClick, selectedIngredient, stepIngredientsForStep }, ref) {
  const matches = selectedIngredient
    ? (stepIngredientsForStep
        ? stepIngredientsForStep.some(i => i.id === selectedIngredient.id)
        : fuzzyMatch(step.instruction, selectedIngredient.name))
    : false
  const dimmed = selectedIngredient && !matches

  const borderColor = selectedIngredient
    ? (matches ? 'var(--accent)' : 'transparent')
    : (isActive ? 'var(--accent)' : 'transparent')

  const bgColor = selectedIngredient
    ? (matches ? 'color-mix(in srgb, var(--accent) 6%, var(--card))' : 'var(--card)')
    : (isActive ? 'color-mix(in srgb, var(--accent) 6%, var(--card))' : 'var(--card)')

  const highlightedHtml = selectedIngredient && matches
    ? buildHighlightedHtml(step.instruction, selectedIngredient.name)
    : null

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-card)',
        marginBottom: '1rem',
        padding: '1.25rem 1.25rem 1.25rem 1.5rem',
        background: bgColor,
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: `4px solid ${borderColor}`,
        borderRight: `2px solid ${borderColor}`,
        position: 'relative',
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Step number */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: (isActive && !selectedIngredient) || matches ? 'var(--accent)' : 'var(--border-input)',
          color: (isActive && !selectedIngredient) || matches ? '#fff' : 'var(--subtext)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem', fontWeight: 700,
          transition: 'all 0.2s ease',
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {step.title && (
            <h3 style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--accent)',
              margin: '0 0 0.375rem',
              lineHeight: 1.3,
            }}>{step.title}</h3>
          )}
          {highlightedHtml ? (
            <p
              style={{ margin: step.title ? '0' : '0.2rem 0 0', lineHeight: 1.65, fontSize: '0.95rem', color: 'var(--text)' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <p style={{ margin: step.title ? '0' : '0.2rem 0 0', lineHeight: 1.65, fontSize: '0.95rem', color: 'var(--text)' }}>
              {step.instruction}
            </p>
          )}

          {/* Step images with scroll dots */}
          {stepImages?.length > 0 && (
            <StepImageRow images={stepImages} onImageClick={onImageClick} />
          )}

          {/* Timer button */}
          {step.timer_seconds && (
            <button
              onClick={e => { e.stopPropagation(); onAddTimer() }}
              style={{
                marginTop: '0.875rem',
                padding: '0.35rem 0.875rem',
                background: hasActiveTimer ? 'rgba(200,96,42,0.15)' : 'none',
                border: `1.5px solid ${hasActiveTimer ? 'var(--accent)' : 'var(--border-input)'}`,
                borderRadius: 'var(--radius-pill)',
                color: hasActiveTimer ? 'var(--accent)' : 'var(--subtext)',
                fontSize: '0.8rem',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s',
              }}
            >
              ⏱ {fmtTime(step.timer_seconds)} {hasActiveTimer ? '(läuft)' : 'starten'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

// ── Ingredient strip (mobile, bottom of screen) ───────────────────────────────

function IngredientStrip({ activeStep, stepIngredients, onIngredientClick, selectedIngredient }) {
  const [expanded, setExpanded] = useState(true)
  const items = stepIngredients || []

  if (!activeStep || items.length === 0) return null

  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 90,
        background: 'var(--card)', borderTop: '1px solid rgba(0,0,0,.07)',
        boxShadow: '0 -4px 20px rgba(0,0,0,.08)',
      }}
    >
      {!expanded ? (
        <div onClick={() => setExpanded(true)} style={{ padding: '10px 18px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            {items.slice(0, 6).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5 + i * 0.08 }} />
            ))}
          </div>
          <i className="ti ti-chevron-up" style={{ fontSize: 14, color: 'var(--accent)' }} />
        </div>
      ) : (
        <div>
          <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                Schritt {activeStep.sort_order ?? 1}
              </span>
              {activeStep.title && (
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3 }}>{activeStep.title}</div>
              )}
            </div>
            <button onClick={() => setExpanded(false)} style={{ background: 'rgba(0,0,0,.06)', border: 'none', color: 'var(--subtext)', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>
              <i className="ti ti-chevron-down" />
            </button>
          </div>
          <div style={{ padding: '10px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {items.map(ing => (
              <div
                key={ing.id}
                onClick={() => onIngredientClick(ing)}
                style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: selectedIngredient?.id === ing.id ? 'var(--accent)' : 'rgba(200,96,42,.1)',
                  color: selectedIngredient?.id === ing.id ? '#fff' : 'var(--accent)',
                  fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {ing.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Rezept wird geladen …</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setDynamicLabel } = useNavigation()
  const isAdmin = isChefkochOrAbove(user)
  const { timers, add: addTimer, remove: removeTimer, addTime } = useTimerContext()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasFreeAccess, setHasFreeAccess] = useState(false)
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [servings, setServings] = useState(4)
  const [stepIngredients, setStepIngredients] = useState({})
  const [ingredientView, setIngredientView] = useState('grouped')
  const [panelOpen, setPanelOpen] = useState(false)
  const [recipeMedia, setRecipeMedia] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [suggestionImgs, setSuggestionImgs] = useState({})
  const [stepMedia, setStepMedia] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState([])
  const [selectedIngredient, setSelectedIngredient] = useState(null)
  const [usedIn, setUsedIn] = useState(null)

  const stepRefs = useRef({})

  // Fetch recipe + media
  useEffect(() => {
    setLoading(true)
    client.get(`/api/recipes/${id}`)
      .then(res => {
        const r = res.data
        setRecipe(r)
        setServings(r.servings || 4)
        setDynamicLabel(`/recipes/${id}`, r.title)
        client.get(`/api/media/entity/recipe/${id}`)
          .then(m => setRecipeMedia(m.data))
          .catch(() => {})
        if (r.steps?.length) {
          Promise.all(
            r.steps.map(s =>
              client.get(`/api/media/entity/step/${s.id}`)
                .then(m => ({ stepId: s.id, media: m.data }))
                .catch(() => ({ stepId: s.id, media: [] }))
            )
          ).then(results => {
            const map = {}
            results.forEach(({ stepId, media }) => { map[stepId] = media })
            setStepMedia(map)
          })
        }
      })
      .catch(() => navigate('/recipes'))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch step ingredients when active step changes
  useEffect(() => {
    if (!recipe) return
    const step = recipe.steps[activeStepIdx]
    if (!step || stepIngredients[step.id] !== undefined) return
    client.get(`/api/recipes/${id}/steps/${step.id}/ingredients`)
      .then(res => setStepIngredients(p => ({ ...p, [step.id]: res.data.ingredients })))
      .catch(() => setStepIngredients(p => ({ ...p, [step.id]: [] })))
  }, [activeStepIdx, recipe])

  // Deep-link to a step via URL hash, e.g. #step-2
  useEffect(() => {
    if (loading || !recipe || !stepMedia) return
    const match = /^#step-(\d+)$/.exec(window.location.hash)
    if (!match) return
    window.dispatchEvent(new CustomEvent('scroll-to-step', { detail: { stepIdx: parseInt(match[1]) } }))
  }, [loading, recipe, stepMedia])

  // Listen for cross-page scroll-to-step events from TimerWidgetGlobal
  useEffect(() => {
    const handler = e => {
      const { stepIdx } = e.detail
      const el = stepRefs.current[stepIdx]
      if (!el) return
      const NAVBAR_HEIGHT = 64
      const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_HEIGHT - 16
      window.scrollTo({ top, behavior: 'smooth' })
      setActiveStepIdx(stepIdx)
    }
    window.addEventListener('scroll-to-step', handler)
    return () => window.removeEventListener('scroll-to-step', handler)
  }, [])

  // Click on an ingredient: clear the active step, mark all steps containing it
  const handleSelectIngredient = (ing) => {
    setSelectedIngredient(ing)
    setActiveStepIdx(null)
  }

  const canEdit = recipe
    ? (isAdmin || (isKochOrAbove(user) && recipe.created_by === user?.id))
    : false

  // Load access info to show public badge (only for authorized editors)
  useEffect(() => {
    if (!recipe || !isKochOrAbove(user) || !canEdit) return
    client.get(`/api/recipes/${recipe.id}/access`, { params: { page: 1, page_size: 10 } })
      .then(({ data }) => setHasFreeAccess(data.items?.some(a => a.access_type === 'free_for_all') ?? false))
      .catch(() => {})
  }, [recipe?.id, user?.id])

  // Fetch how often this recipe is used as a module (only for logged-in users)
  useEffect(() => {
    if (!recipe || !user) return
    client.get(`/api/recipes/${recipe.id}/used-in`)
      .then(res => setUsedIn(res.data.count))
      .catch(() => {})
  }, [recipe?.id, user?.id])

  // Fetch suggestions (Dazu passt auch)
  useEffect(() => {
    if (!recipe) return
    client.get('/api/recipes/random', { params: { count: 4 } })
      .then(({ data }) => {
        const items = (data || []).filter(r => r.id !== recipe.id).slice(0, 3)
        setSuggestions(items)
        items.forEach(r => {
          client.get(`/api/media/entity/recipe/${r.id}`)
            .then(({ data: mData }) => {
              const p = mData.find(m => m.is_primary && m.media_type === 'image') ?? null
              setSuggestionImgs(prev => ({ ...prev, [r.id]: p }))
            })
            .catch(() => {})
        })
      })
      .catch(() => {})
  }, [recipe?.id])

  if (loading) return <LoadingScreen />
  if (!recipe) return null
  const activeStep = recipe.steps[activeStepIdx]
  const activeIds = new Set((activeStep ? stepIngredients[activeStep.id] : [])?.map(i => i.id) ?? [])
  const baseServings = recipe.servings || 4

  const openRecipeLightbox = (url) => {
    const list = recipeMedia
      .filter(m => m.media_type === 'image')
      .map(m => ({ url: m.url, caption: '' }))
    const idx = list.findIndex(img => img.url === url)
    setLightboxImages(list)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  const openStepLightbox = (url, imgs) => {
    const list = (imgs || []).map(m => ({ url: m.url, caption: '' }))
    const idx = list.findIndex(img => img.url === url)
    setLightboxImages(list)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{`.ingredient-highlight { background: rgba(200,96,42,0.18); border-radius: 3px; padding: 0 2px; } [data-theme="dark"] .ingredient-highlight { background: rgba(200,96,42,0.30); }`}</style>

      {/* Nav bar — desktop only (mobile breadcrumb is in hero overlay) */}
      <div className="hidden md:flex" style={{ padding: '0.875rem 1.5rem', maxWidth: '1200px', margin: '0 auto', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <Breadcrumb items={[
          { label: 'Alle Rezepte', path: '/recipes' },
          { label: recipe?.title || '…', path: null },
        ]} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEdit && recipe && (
            <button
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
              style={{
                padding: '0.4rem 1rem',
                border: '1.5px solid var(--accent)',
                borderRadius: 'var(--radius-pill)',
                background: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                transition: 'var(--transition)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,96,42,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              ✏ Bearbeiten
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <div className="md:flex md:gap-8" style={{ alignItems: 'flex-start' }}>

          {/* Ingredient sidebar */}
          <IngredientSidebar
            recipe={recipe}
            servings={servings}
            baseServings={baseServings}
            onServingsChange={setServings}
            activeIds={activeIds}
            view={ingredientView}
            onViewChange={setIngredientView}
            selectedIngredient={selectedIngredient}
            onSelectIngredient={handleSelectIngredient}
          />

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <HeroSection recipe={recipe} media={recipeMedia} onImageClick={openRecipeLightbox} canEdit={canEdit} onEdit={() => navigate(`/recipes/${recipe.id}/edit`)} />

            {user && usedIn > 0 && (
              <div
                data-track-id="detail-module-used-in"
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--subtext)',
                  marginBottom: '1rem',
                  padding: '0.4rem 0.875rem',
                  background: 'var(--card)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Wird als Modul verwendet in {usedIn} {usedIn === 1 ? 'Rezept' : 'Rezepten'}
              </div>
            )}

            <MetaBar recipe={recipe} />

            {/* Freigaben verwalten (only for Koch and above) */}
            {isKochOrAbove(user) && canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {hasFreeAccess && (
                  <span style={{ fontSize: '0.8rem', background: 'rgba(107,124,78,0.15)', color: '#4A7040', borderRadius: '6px', padding: '0.25rem 0.625rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                    🌍 Öffentlich zugänglich
                  </span>
                )}
                <Link
                  to="/profile#meine-rezepte"
                  style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtext)' }}
                >
                  Freigaben verwalten →
                </Link>
              </div>
            )}

            {/* Author + dates bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--subtext)' }}>
              {recipe.author && (
                <span>
                  von{' '}
                  <AuthorLink author={recipe.author} />
                </span>
              )}
              {recipe.author && <span>·</span>}
              <span>{new Date(recipe.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              {recipe.updated_at && recipe.updated_at !== recipe.created_at && (
                <>
                  <span>·</span>
                  <span>geändert {new Date(recipe.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </>
              )}
            </div>

            {/* Module author attribution (foreign modules only) */}
            {recipe.module_authors?.filter(a => a.id !== user?.id).length > 0 && (
              <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {recipe.module_authors.filter(a => a.id !== user?.id).map(author => (
                  <div
                    key={author.id}
                    data-track-id="detail-module-author-link"
                    style={{ fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}
                  >
                    Enthält Rezept von <AuthorLink author={author} />
                  </div>
                ))}
              </div>
            )}

            {/* Steps */}
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1.25rem', color: 'var(--text)' }}>
              Zubereitung
            </h2>

            {recipe.steps.length === 0 ? (
              <p style={{ color: 'var(--subtext)', fontStyle: 'italic' }}>Noch keine Zubereitungsschritte vorhanden.</p>
            ) : (
              recipe.steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  ref={el => { stepRefs.current[idx] = el }}
                  step={step}
                  index={idx}
                  isActive={idx === activeStepIdx}
                  onClick={() => { setActiveStepIdx(idx); setSelectedIngredient(null) }}
                  onAddTimer={() => addTimer(recipe.id, recipe.title, idx, step.timer_label || step.title || `Timer ${idx + 1}`, step.timer_seconds)}
                  hasActiveTimer={timers.some(t => t.stepIdx === idx && t.remaining > 0)}
                  stepImages={(stepMedia?.[step.id] || []).filter(m => m.media_type === 'image' && m.processing_status === 'ready' && !m.deleted_at)}
                  onImageClick={openStepLightbox}
                  selectedIngredient={selectedIngredient}
                  stepIngredientsForStep={stepIngredients[step.id]}
                />
              ))
            )}

            {/* Dazu passt auch */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text)' }}>
                  Dazu passt auch
                </h2>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                  {suggestions.map(r => (
                    <SuggestionCard
                      key={r.id}
                      recipe={r}
                      image={suggestionImgs[r.id]}
                      onClick={() => navigate(`/recipes/${r.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile ingredient panel (left pull-tab + slide panel) */}
      <MobileIngredientPanel
        recipe={recipe}
        servings={servings}
        baseServings={baseServings}
        onServingsChange={setServings}
        activeIds={activeIds}
        open={panelOpen}
        onOpen={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
        selectedIngredient={selectedIngredient}
        onSelectIngredient={handleSelectIngredient}
      />

      {/* Ingredient strip (mobile, shows active step ingredients as pills) */}
      <IngredientStrip
        activeStep={recipe.steps[activeStepIdx]}
        stepIngredients={stepIngredients[recipe.steps[activeStepIdx]?.id]}
        onIngredientClick={ing => handleSelectIngredient(selectedIngredient?.id === ing.id ? null : { id: ing.id, name: ing.name })}
        selectedIngredient={selectedIngredient}
      />

      {/* Lightbox */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <MediaLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

