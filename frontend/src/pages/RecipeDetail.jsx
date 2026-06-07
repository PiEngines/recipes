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
  return ingredients.some(ing => {
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

function HeroSection({ recipe, media, onImageClick }) {
  const gradient = GRADIENTS[recipe.id % GRADIENTS.length]
  const primary = media.find(m => m.is_primary && m.media_type === 'image')
  const gallery = media.filter(m => !m.is_primary && m.media_type === 'image' && m.processing_status === 'ready' && !m.deleted_at)

  return (
    <>
      {/* Hero */}
      <div
        onClick={primary ? () => onImageClick?.(primary.url) : undefined}
        style={{
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
          position: 'relative',
          height: '280px',
          background: primary ? undefined : gradient,
          backgroundImage: primary ? `url(${primary.thumbnail_url || primary.url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          cursor: primary ? 'zoom-in' : 'default',
        }}
      >
        <FavoriteHeart recipeId={recipe.id} size={26} style={{ position: 'absolute', top: '0.875rem', left: '0.875rem', zIndex: 3 }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55) 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '1.5rem',
        }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 600, color: '#fff', margin: '0 0 0.5rem', textShadow: '0 2px 8px rgba(0,0,0,0.4)', lineHeight: 1.25 }}>
            {recipe.title}
          </h1>
          {recipe.description && (
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {recipe.description}
            </p>
          )}
        </div>
      </div>

      {/* Galerie */}
      {gallery.length > 0 && (
        <div style={{ display: 'flex', gap: '0.625rem', overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
          {gallery.map(m => (
            <img
              key={m.id}
              src={m.url}
              alt=""
              onClick={e => { e.stopPropagation(); onImageClick?.(m.url) }}
              style={{ height: '80px', width: 'auto', borderRadius: 'var(--radius-input)', objectFit: 'cover', display: 'block', cursor: 'zoom-in', flexShrink: 0 }}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Meta bar ──────────────────────────────────────────────────────────────────

function MetaBar({ recipe }) {
  const color = recipe.difficulty ? diffColor(recipe.difficulty) : null
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '1rem',
      padding: '1rem 1.25rem',
      background: 'var(--card)',
      borderRadius: 'var(--radius-card)',
      marginBottom: '1.5rem',
      boxShadow: 'var(--shadow)',
    }}>
      {recipe.prep_time && <MetaStat icon="⏱" label="Vorbereitung" value={`${recipe.prep_time} min`} />}
      {recipe.cook_time && <MetaStat icon="🍳" label="Kochen" value={`${recipe.cook_time} min`} />}
      {recipe.servings && <MetaStat icon="🍽️" label="Portionen" value={String(recipe.servings)} />}
      {recipe.difficulty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--subtext)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schwierigkeit</span>
          <DifficultySpoons difficulty={recipe.difficulty} />
        </div>
      )}

      {(recipe.diet_labels?.length > 0 || recipe.allergens?.length > 0) && (
        <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          {recipe.diet_labels?.map(d => <Pill key={d.id} color="var(--secondary)">{d.name}</Pill>)}
          {recipe.allergens?.map(a => <Pill key={a.id} color="#C8A020">{a.name}</Pill>)}
        </div>
      )}
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
  const grouped = {}
  for (const ing of ingredients) {
    const key = ing.component_label || ''
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ing)
  }
  const groups = Object.entries(grouped)

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
    return <div>{ingredients.map(renderIng)}</div>
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

// ── Mobile ingredients drawer ─────────────────────────────────────────────────

function MobileDrawer({ recipe, servings, baseServings, onServingsChange, activeIds, onClose, selectedIngredient, onSelectIngredient }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
  const minusDisabled = wouldDropBelowMin(recipe.ingredients, servings, baseServings)
  return (
    <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--card)',
        borderRadius: '20px 20px 0 0',
        padding: '1.25rem 1.5rem 2rem',
        maxHeight: '75vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>Zutaten</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--subtext)', lineHeight: 1 }}>✕</button>
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

const StepCard = forwardRef(function StepCard({ step, index, isActive, onClick, onAddTimer, hasActiveTimer, stepImages, onImageClick, selectedIngredient }, ref) {
  const matches = selectedIngredient ? fuzzyMatch(step.instruction, selectedIngredient.name) : false
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [recipeMedia, setRecipeMedia] = useState([])
  const [stepMedia, setStepMedia] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState([])
  const [selectedIngredient, setSelectedIngredient] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch step ingredients when active step changes
  useEffect(() => {
    if (!recipe) return
    const step = recipe.steps[activeStepIdx]
    if (!step || stepIngredients[step.id] !== undefined) return
    client.get(`/api/recipes/${id}/steps/${step.id}/ingredients`)
      .then(res => setStepIngredients(p => ({ ...p, [step.id]: res.data })))
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

  const canEdit = recipe
    ? (isAdmin || (isKochOrAbove(user) && recipe.created_by === user?.id))
    : false
  const canDelete = recipe
    ? (isAdmin || recipe.created_by === user?.id)
    : false

  const handleDeleteRecipe = async () => {
    try {
      await client.delete(`/api/recipes/${id}`)
      navigate('/')
    } catch {
      setShowDeleteConfirm(false)
    }
  }

  // Load access info to show public badge (only for authorized editors)
  useEffect(() => {
    if (!recipe || !isKochOrAbove(user) || !canEdit) return
    client.get(`/api/recipes/${recipe.id}/access`, { params: { page: 1, page_size: 10 } })
      .then(({ data }) => setHasFreeAccess(data.items?.some(a => a.access_type === 'free_for_all') ?? false))
      .catch(() => {})
  }, [recipe?.id, user?.id])

  if (loading) return <LoadingScreen />
  if (!recipe) return null
  const activeStep = recipe.steps[activeStepIdx]
  const activeIds = new Set((activeStep ? stepIngredients[activeStep.id] : [])?.map(i => i.id) ?? [])
  const baseServings = recipe.servings || 4

  const openRecipeLightbox = (url) => {
    const list = recipeMedia
      .filter(m => m.media_type === 'image' && m.processing_status === 'ready' && !m.deleted_at)
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

      {/* Nav bar */}
      <div style={{ padding: '0.875rem 1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <Breadcrumb items={[
          { label: 'Alle Rezepte', path: '/' },
          { label: recipe?.title || '…', path: null },
        ]} />
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
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
          {canDelete && recipe && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '0.4rem 1rem',
                border: '1.5px solid rgba(200,68,68,0.5)',
                borderRadius: 'var(--radius-pill)',
                background: 'none',
                color: '#C84444',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                transition: 'var(--transition)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,68,68,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              Löschen
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
            onSelectIngredient={setSelectedIngredient}
          />

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <HeroSection recipe={recipe} media={recipeMedia} onImageClick={openRecipeLightbox} />
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
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile floating ingredients button */}
      <div className="md:hidden" style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 90 }}>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--secondary)', color: '#fff',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', position: 'relative',
          }}
          title="Zutaten anzeigen"
        >
          🥗
          {activeIds.size > 0 && (
            <span style={{
              position: 'absolute', top: '-3px', right: '-3px',
              background: 'var(--accent)', color: '#fff',
              borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
              minWidth: '16px', height: '16px', padding: '0 3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}>
              {activeIds.size}
            </span>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <MobileDrawer
          recipe={recipe}
          servings={servings}
          baseServings={baseServings}
          onServingsChange={setServings}
          activeIds={activeIds}
          onClose={() => setDrawerOpen(false)}
          selectedIngredient={selectedIngredient}
          onSelectIngredient={setSelectedIngredient}
        />
      )}

      {/* Lightbox */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <MediaLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 0.5rem', lineHeight: 1.5, fontWeight: 600 }}>
              Rezept löschen?
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--subtext)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              „{recipe.title}" wird in den Papierkorb verschoben und nach 30 Tagen endgültig gelöscht.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteRecipe}
                style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                In den Papierkorb
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

