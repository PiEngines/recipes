import { Fragment, forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTimerContext } from '../context/TimerContext'
import { useNavigation } from '../context/NavigationContext'
import MediaLightbox from '../components/MediaLightbox'
import Breadcrumb from '../components/Breadcrumb'
import BackButton from '../components/BackButton'
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

// ── Difficulty labels ─────────────────────────────────────────────────────────

const DIFF_LABELS = ['', 'Sehr leicht', 'Leicht', 'Mittel', 'Schwer', 'Sehr schwer']

// ── Shared button styles ──────────────────────────────────────────────────────

const adjBtn = {
  width: 28, height: 28, borderRadius: '50%',
  border: '1.5px solid var(--border-input)', background: 'none',
  cursor: 'pointer', fontSize: '1rem', color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, fontFamily: 'Inter, sans-serif',
}

const adjBtnDisabled = { ...adjBtn, cursor: 'default', opacity: 0.4, color: 'var(--subtext)' }

const adjBtnPlus = {
  width: 28, height: 28, borderRadius: '50%',
  border: 'none', background: 'rgba(200,96,42,.1)',
  cursor: 'pointer', fontSize: '1rem', color: 'var(--accent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, fontFamily: 'Inter, sans-serif',
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
    <div className="mt-3 mx-3 mb-3 md:mt-0 md:mx-0">
      {/* Main hero image */}
      <div
        onClick={active ? () => onImageClick?.(active.url) : undefined}
        style={{
          borderRadius: 16, overflow: 'hidden', position: 'relative', height: 250,
          background: active ? undefined : gradient,
          cursor: active ? 'zoom-in' : 'default',
        }}
      >
        {active && (
          <div
            className="card-image-bg"
            style={{ position: 'absolute', inset: 0, backgroundImage: `url(${active.thumbnail_url || active.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.22) 0%, transparent 35%, rgba(0,0,0,.62) 100%)' }} />

        {/* Mobile breadcrumb + edit */}
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

        {/* Heart */}
        <FavoriteHeart
          recipeId={recipe.id} recipe={recipe} size={20} outline={false} trackId="detail-favorite-toggle"
          style={{ position: 'absolute', bottom: 18, right: 14, background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, padding: 0 }}
        />

        {/* Title first, description below */}
        <div style={{ position: 'absolute', bottom: 18, left: 16, right: 58 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.625rem, 6.7vw, 2rem)', fontWeight: 700, fontStyle: 'italic', color: '#fff', lineHeight: 1.2, textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>
            {recipe.title}
          </div>
          {recipe.description && (
            <div style={{ marginTop: 6, display: 'inline-block', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 6, padding: '4px 10px', maxWidth: '100%' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', lineHeight: 1.45, overflow: 'hidden', maxHeight: 34, fontFamily: 'Inter, sans-serif' }}>
                {recipe.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gallery strip */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginTop: 8 }}>
          {images.map((img, i) => (
            <div
              key={img.id}
              onClick={e => { e.stopPropagation(); setActiveIdx(i) }}
              style={{
                width: 68, height: 52, flexShrink: 0, borderRadius: 8, cursor: 'pointer',
                backgroundImage: `url(${img.thumbnail_url || img.url})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: `2px solid ${i === activeIdx ? 'var(--accent)' : 'transparent'}`,
                boxSizing: 'border-box', transition: 'border-color .15s',
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
    recipe.prep_time ? { label: 'Vorbereitung', icon: 'ti-clock', time: recipe.prep_time } : null,
    recipe.cook_time ? { label: 'Kochen', icon: 'ti-flame', time: recipe.cook_time } : null,
    { label: 'Art', text: recipe.type === 'backen' ? 'Backen' : 'Kochen' },
    recipe.difficulty ? { label: 'Schwierigkeit', text: DIFF_LABELS[recipe.difficulty] || String(recipe.difficulty) } : null,
  ].filter(Boolean)

  return (
    <div className="md:px-0" style={{ padding: '8px 18px', display: 'flex', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
      {cols.map((col, i) => (
        <Fragment key={i}>
          {i > 0 && <div style={{ width: 1, background: 'rgba(0,0,0,.08)', margin: '0 4px', flexShrink: 0 }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: i > 0 ? 12 : 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--subtext)', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Inter, sans-serif' }}>
              {col.icon && <i className={`ti ${col.icon}`} style={{ fontSize: 10 }} />}
              {col.label}
            </span>
            {col.time != null ? (
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent)', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>
                {col.time}<span style={{ fontSize: 12, color: 'var(--subtext)', fontWeight: 400, marginLeft: 2 }}>min</span>
              </span>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
                {col.text}
              </span>
            )}
          </div>
        </Fragment>
      ))}
    </div>
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
    const highlighted = active || selected
    const scaled = scaleAmount(ing.amount, scaleFactor, ing.unit, ing.is_integer)
    return (
      <div
        key={ing.id}
        onClick={() => onSelectIngredient?.(selected ? null : { id: ing.id, name: ing.name })}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 6px', margin: '0 -6px',
          borderRadius: selected ? 6 : 0,
          borderBottom: selected ? 'none' : '1px solid rgba(0,0,0,.06)',
          background: selected ? 'rgba(200,96,42,.08)' : 'transparent',
          outline: selected ? '1.5px solid rgba(200,96,42,.3)' : 'none',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 14, flex: 1, color: highlighted ? 'var(--accent)' : 'var(--text)', fontWeight: highlighted ? 600 : 400, fontFamily: 'Inter, sans-serif', transition: 'color .15s' }}>
          {ing.name}
        </span>
        {(scaled || ing.unit) && (
          <span style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0, paddingLeft: 8, color: highlighted ? 'var(--accent)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', transition: 'color .15s' }}>
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

function IngredientSidebar({ recipe, servings, baseServings, onServingsChange, activeIds, selectedIngredient, onSelectIngredient }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
  const minusDisabled = wouldDropBelowMin(recipe.ingredients, servings, baseServings)
  return (
    <aside className="hidden md:flex" style={{
      width: 260, flexShrink: 0, flexDirection: 'column',
      position: 'sticky', top: 72, maxHeight: 'calc(100vh - 88px)',
      background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,0,0,.07)', flexShrink: 0 }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Zutaten</h3>
      </div>

      {/* Servings */}
      {recipe.servings && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,.07)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--subtext)', flex: 1, fontFamily: 'Inter, sans-serif' }}>Portionen</span>
          <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} disabled={minusDisabled} style={minusDisabled ? adjBtnDisabled : adjBtn}><i className="ti ti-minus" /></button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: 'center', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{servings}</span>
          <button onClick={() => onServingsChange(s => s + 1)} style={adjBtnPlus}><i className="ti ti-plus" /></button>
        </div>
      )}

      {/* List */}
      <div style={{ overflowY: 'auto', padding: '4px 16px 24px', flex: 1 }}>
        <IngredientList
          ingredients={recipe.ingredients}
          scaleFactor={scaleFactor}
          activeIds={activeIds}
          view="grouped"
          selectedIngredient={selectedIngredient}
          onSelectIngredient={onSelectIngredient}
        />
      </div>
    </aside>
  )
}

// ── Mobile ingredient panel (left pull-tab + slide panel) ─────────────────────

function MobileIngredientPanel({ recipe, servings, baseServings, onServingsChange, activeIds, open, onOpen, onClose, selectedIngredient, onSelectIngredient }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
  const minusDisabled = wouldDropBelowMin(recipe.ingredients, servings, baseServings)
  return (
    <>
      {/* Pull tab — hides when panel is open */}
      <div
        className="md:hidden"
        onClick={onOpen}
        data-track-id="detail-ingredient-pull-tab"
        style={{
          position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
          zIndex: 35, background: 'var(--accent)',
          borderRadius: '0 10px 10px 0', padding: '14px 8px',
          boxShadow: '2px 2px 14px rgba(200,96,42,.38)',
          cursor: 'pointer', flexDirection: 'column', alignItems: 'center', gap: 5,
          opacity: open ? 0 : 1,
          pointerEvents: open ? 'none' : 'all',
          transition: 'opacity .25s ease',
        }}
      >
        <i className="ti ti-basket" style={{ fontSize: 18, color: '#fff' }} />
        {activeIds.size > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.22)', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
            {activeIds.size}
          </span>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="md:hidden"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.3)',
          opacity: open ? 1 : 0,
          transition: 'opacity .3s ease',
          pointerEvents: open ? 'all' : 'none',
          zIndex: 39,
        }}
      />

      {/* Slide panel */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed', left: 0, top: 52, bottom: 60,
          width: '65%', maxWidth: 280,
          background: 'var(--card)',
          boxShadow: '6px 0 28px rgba(0,0,0,.14)',
          zIndex: 40,
          flexDirection: 'column',
          borderRadius: '0 12px 12px 0',
          overflow: 'hidden',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,0,0,.07)', flexShrink: 0, gap: 8 }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.125rem', fontWeight: 700, flex: 1, margin: 0, color: 'var(--text)' }}>Zutaten</h3>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,.06)', border: 'none', color: 'var(--subtext)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>
        {recipe.servings && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,.07)', flexShrink: 0, gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--subtext)', flex: 1, fontFamily: 'Inter, sans-serif' }}>Portionen</span>
            <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} disabled={minusDisabled} style={minusDisabled ? adjBtnDisabled : adjBtn}><i className="ti ti-minus" /></button>
            <span style={{ fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: 'center', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{servings}</span>
            <button onClick={() => onServingsChange(s => s + 1)} style={adjBtnPlus}><i className="ti ti-plus" /></button>
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: '4px 16px 24px', flex: 1 }}>
          <IngredientList
            ingredients={recipe.ingredients}
            scaleFactor={scaleFactor}
            activeIds={activeIds}
            view="grouped"
            selectedIngredient={selectedIngredient}
            onSelectIngredient={onSelectIngredient}
          />
        </div>
      </div>
    </>
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
    <div style={{ marginTop: 12 }}>
      <div ref={containerRef} onScroll={handleScroll} style={{ display: 'flex', gap: 8, overflowX: 'auto', width: '100%', scrollbarWidth: 'none', paddingBottom: 6 }}>
        {images.map(m => (
          <img
            key={m.id}
            src={m.url}
            alt=""
            onClick={e => { e.stopPropagation(); onImageClick?.(m.url, images) }}
            style={{ height: 86, width: 130, borderRadius: 10, objectFit: 'cover', flexShrink: 0, cursor: 'zoom-in' }}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 4 }}>
          {images.map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === activeIdx ? '#C8602A' : 'rgba(0,0,0,.18)', flexShrink: 0 }} />
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
  const highlighted = selectedIngredient ? matches : isActive
  const borderColor = highlighted ? '#C8602A' : 'transparent'

  const highlightedHtml = selectedIngredient && matches
    ? buildHighlightedHtml(step.instruction, selectedIngredient.name)
    : null

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        borderRadius: 12, marginBottom: 8, padding: '14px 14px 14px 12px',
        background: highlighted ? 'color-mix(in srgb, var(--accent) 6%, var(--card))' : 'var(--card)',
        boxShadow: highlighted ? '0 2px 10px rgba(200,96,42,.1)' : '0 1px 4px rgba(0,0,0,.06)',
        cursor: 'pointer', transition: 'all 0.2s ease',
        borderLeft: `4px solid ${borderColor}`,
        borderRight: `2px solid ${borderColor}`,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: highlighted ? '#C8602A' : '#E8E4DE',
          color: highlighted ? '#fff' : '#6B6B68',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, marginTop: 1,
          transition: 'all 0.2s ease',
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {step.title && (
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, lineHeight: 1.3 }}>
              {step.title}
            </div>
          )}
          {highlightedHtml ? (
            <div
              style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', margin: step.title ? 0 : '0.2rem 0 0' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', margin: step.title ? 0 : '0.2rem 0 0' }}>
              {step.instruction}
            </div>
          )}

          {stepImages?.length > 0 && (
            <StepImageRow images={stepImages} onImageClick={onImageClick} />
          )}

          {step.timer_seconds && (
            <button
              onClick={e => { e.stopPropagation(); onAddTimer() }}
              data-track-id="detail-timer-start"
              style={{
                marginTop: 10, padding: '5px 14px',
                background: hasActiveTimer ? 'rgba(200,96,42,.1)' : 'transparent',
                border: `1.5px solid ${hasActiveTimer ? '#C8602A' : '#D8D4CD'}`,
                borderRadius: 999,
                color: hasActiveTimer ? '#C8602A' : '#6B6B68',
                fontSize: 13, fontFamily: 'Inter, sans-serif',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
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

// ── Ingredient strip (mobile bottom — checklist) ──────────────────────────────

function IngredientStrip({ activeStep, stepIngredients, scaleFactor, checkedIngredients, onToggleChecked }) {
  const [expanded, setExpanded] = useState(true)
  const items = stepIngredients || []
  const showStrip = !!activeStep && items.length > 0

  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed', bottom: 60, left: 0, right: 0,
        maxWidth: 430, margin: '0 auto', zIndex: 44,
        background: 'var(--card)',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,.1)',
        transform: showStrip ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {!expanded ? (
        <div onClick={() => setExpanded(true)} style={{ padding: '10px 18px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            {[...items].sort((a, b) => (checkedIngredients[a.id] ? 1 : 0) - (checkedIngredients[b.id] ? 1 : 0)).map(ing => (
              <div key={ing.id} style={{
                width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
                border: '2px solid #C8602A',
                background: checkedIngredients[ing.id] ? '#C8602A' : 'transparent',
                transition: 'background .2s ease',
              }} />
            ))}
          </div>
          <i className="ti ti-chevron-up" style={{ fontSize: 14, color: 'var(--accent)' }} />
        </div>
      ) : (
        <div>
          <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                Schritt {activeStep?.sort_order ?? 1}
              </span>
              {activeStep?.title && (
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3 }}>
                  {activeStep.title}
                </div>
              )}
            </div>
            <button onClick={() => setExpanded(false)} style={{ background: 'rgba(0,0,0,.06)', border: 'none', color: 'var(--subtext)', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
              <i className="ti ti-chevron-down" />
            </button>
          </div>
          <div style={{ padding: '12px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map(ing => {
              const checked = !!checkedIngredients[ing.id]
              const scaled = scaleAmount(ing.amount, scaleFactor, ing.unit, ing.is_integer)
              const amtStr = scaled ? `${scaled}${ing.unit ? ' ' + ing.unit : ''}` : ''
              const label = ing.name + (amtStr ? ' · ' + amtStr : '')
              return (
                <div
                  key={ing.id}
                  onClick={() => onToggleChecked(ing.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 999,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: checked ? 'rgba(0,0,0,.07)' : '#C8602A',
                    color: checked ? '#9A958C' : '#fff',
                    textDecoration: checked ? 'line-through' : 'none',
                    transition: 'all .2s ease', userSelect: 'none',
                  }}
                >
                  {label}
                </div>
              )
            })}
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
  const location = useLocation()
  const isPreview = new URLSearchParams(location.search).has('preview')
  const { user } = useAuth()
  const { setDynamicLabel } = useNavigation()
  const isAdmin = isChefkochOrAbove(user)
  const { timers, add: addTimer } = useTimerContext()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [servings, setServings] = useState(4)
  const [stepIngredients, setStepIngredients] = useState({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [recipeMedia, setRecipeMedia] = useState([])
  const [stepMedia, setStepMedia] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState([])
  const [selectedIngredient, setSelectedIngredient] = useState(null)
  const [checkedIngredients, setCheckedIngredients] = useState({})
  const [pillsExpanded, setPillsExpanded] = useState(false)

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

  // Deep-link to a step via URL hash
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
      const top = el.getBoundingClientRect().top + window.scrollY - 64 - 16
      window.scrollTo({ top, behavior: 'smooth' })
      setActiveStepIdx(stepIdx)
    }
    window.addEventListener('scroll-to-step', handler)
    return () => window.removeEventListener('scroll-to-step', handler)
  }, [])

  const handleSelectIngredient = (ing) => {
    setSelectedIngredient(ing)
    setActiveStepIdx(null)
  }

  const canEdit = recipe
    ? (isAdmin || (isKochOrAbove(user) && recipe.created_by === user?.id))
    : false

  if (loading) return <LoadingScreen />
  if (!recipe) return null

  const activeStep = recipe.steps[activeStepIdx]
  const activeIds = new Set((activeStep ? stepIngredients[activeStep.id] : [])?.map(i => i.id) ?? [])
  const baseServings = recipe.servings || 4
  const scaleFactor = baseServings ? servings / baseServings : 1

  const openRecipeLightbox = (url) => {
    const list = recipeMedia.filter(m => m.media_type === 'image').map(m => ({ url: m.url, caption: '' }))
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

  const hasTags = (recipe.diet_labels?.length > 0 || recipe.allergens?.length > 0)
  const pillsChipLabel = pillsExpanded ? '✕ Tags' : (() => {
    const allTags = [...(recipe.diet_labels || []), ...(recipe.allergens || [])].map(x => x.name)
    if (!allTags.length) return null
    let label = '🏷 '
    let built = ''
    let shown = 0
    for (let i = 0; i < allTags.length; i++) {
      const next = (built ? ' · ' : '') + allTags[i]
      if ((built + next).length > 28 && i > 0) return label + built + ' +' + (allTags.length - shown)
      built += next
      shown++
    }
    return label + built
  })()
  const foreignModuleAuthors = recipe.module_authors?.filter(a => a.id !== user?.id) || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{`.ingredient-highlight { background: rgba(200,96,42,0.18); border-radius: 3px; padding: 0 2px; } [data-theme="dark"] .ingredient-highlight { background: rgba(200,96,42,0.30); }`}</style>

      {/* Preview banner */}
      {isPreview && (
        <div style={{ background: 'var(--accent)', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500 }}>Vorschau-Modus</span>
          <button
            data-track-id="recipe-detail-preview-close"
            onClick={() => window.close()}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '0.25rem 0.875rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            ✕ Schließen
          </button>
        </div>
      )}

      {/* Desktop nav bar */}
      <div className="hidden md:flex" style={{ padding: '0.875rem 1.5rem', maxWidth: 1200, margin: '0 auto', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <Breadcrumb items={[
          { label: 'Alle Rezepte', path: '/recipes' },
          { label: recipe?.title || '…', path: null },
        ]} />
      </div>

      {/* Mobile back button */}
      <div className="md:hidden" style={{ padding: '0.75rem 1.25rem 0' }}>
        <BackButton fallback="/recipes" />
      </div>

      {/* Content */}
      <div className="px-0 md:px-6" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '4rem' }}>
        <div className="md:flex md:gap-8" style={{ alignItems: 'flex-start' }}>

          {/* Ingredient sidebar (desktop) */}
          <IngredientSidebar
            recipe={recipe}
            servings={servings}
            baseServings={baseServings}
            onServingsChange={setServings}
            activeIds={activeIds}
            selectedIngredient={selectedIngredient}
            onSelectIngredient={handleSelectIngredient}
          />

          {/* Main column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <HeroSection
              recipe={recipe} media={recipeMedia}
              onImageClick={openRecipeLightbox}
              canEdit={canEdit && !isPreview}
              onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
            />

            {/* MetaBar */}
            <MetaBar recipe={recipe} />

            {/* Author block */}
            <div className="md:px-0" style={{ padding: '6px 18px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {recipe.author && (
                    <span style={{ fontSize: 12, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                      von <AuthorLink author={recipe.author} />
                      {' · '}
                      {new Date(recipe.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {hasTags && (
                    <span
                      onClick={() => setPillsExpanded(p => !p)}
                      style={{ fontSize: 11, color: 'var(--subtext)', background: 'rgba(0,0,0,.06)', borderRadius: 999, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}
                    >
                      {pillsChipLabel}
                    </span>
                  )}
                </div>
                {foreignModuleAuthors.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {foreignModuleAuthors.map(author => (
                      <span key={author.id} data-track-id="detail-module-author-link" style={{ fontSize: 12, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                        inkl. Rezept von <AuthorLink author={author} />
                      </span>
                    ))}
                  </div>
                )}
                {pillsExpanded && hasTags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                    {recipe.diet_labels?.map(d => (
                      <span key={d.id} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#6B7C4E22', color: '#6B7C4E', border: '1px solid #6B7C4E44', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{d.name}</span>
                    ))}
                    {recipe.allergens?.map(a => (
                      <span key={a.id} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: '#C8A02022', color: '#C8A020', border: '1px solid #C8A02044', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{a.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Steps heading */}
            <div className="px-[12px] md:px-0" style={{ paddingTop: 10 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, marginBottom: 4, padding: '0 4px', color: 'var(--text)' }}>
                Zubereitung
              </div>
              <div className="md:hidden" style={{ fontSize: 12, color: 'var(--subtext)', marginBottom: 14, padding: '0 4px', fontFamily: 'Inter, sans-serif' }}>
                Schritt antippen · Zutaten erscheinen unten
              </div>
            </div>

            {/* Steps */}
            <div className="px-[12px] md:px-0">
              {recipe.steps.length === 0 ? (
                <p style={{ color: 'var(--subtext)', fontStyle: 'italic', padding: '0 4px' }}>Noch keine Zubereitungsschritte vorhanden.</p>
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
            </div>
          </div>
        </div>
      </div>

      {/* Mobile ingredient panel */}
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

      {/* Ingredient strip (mobile checklist) */}
      <IngredientStrip
        activeStep={recipe.steps[activeStepIdx]}
        stepIngredients={stepIngredients[recipe.steps[activeStepIdx]?.id]}
        scaleFactor={scaleFactor}
        checkedIngredients={checkedIngredients}
        onToggleChecked={ingId => setCheckedIngredients(prev => ({ ...prev, [ingId]: !prev[ingId] }))}
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
