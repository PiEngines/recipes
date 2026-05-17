import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

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

function scaleAmount(amount, factor) {
  if (!amount || factor === 1) return amount
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(amount.trim())
  if (frac) return fmtNum((parseInt(frac[1]) / parseInt(frac[2])) * factor)
  const n = parseFloat(amount)
  if (isNaN(n)) return amount
  return fmtNum(n * factor)
}

function fmtNum(n) {
  if (Math.abs(n - Math.round(n)) < 0.02) return String(Math.round(n))
  for (const [num, den] of [[1,8],[1,4],[1,3],[3,8],[1,2],[5,8],[2,3],[3,4],[7,8]]) {
    if (Math.abs(n - num / den) < 0.07) return `${num}/${den}`
  }
  return n.toFixed(1).replace(/\.0$/, '')
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    ;[880, 1100, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.22
      g.gain.setValueAtTime(0.25, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.start(t); osc.stop(t + 0.22)
    })
    setTimeout(() => ctx.close(), 800)
  } catch (_) {}
}

// ── Timer hook ────────────────────────────────────────────────────────────────

function useTimers() {
  const [timers, setTimers] = useState([])
  const nextId = useRef(1)

  useEffect(() => {
    const iv = setInterval(() => {
      setTimers(prev => {
        if (prev.every(t => t.remaining <= 0)) return prev
        return prev.map(t => {
          if (t.remaining <= 0) return t
          const r = t.remaining - 1
          if (r === 0) playBeep()
          return { ...t, remaining: r }
        })
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const add = useCallback((stepIdx, label, seconds) => {
    const id = nextId.current++
    setTimers(p => [...p, { id, stepIdx, label, total: seconds, remaining: seconds }])
    return id
  }, [])

  const remove = useCallback(id => setTimers(p => p.filter(t => t.id !== id)), [])
  const addTime = useCallback((id, secs) =>
    setTimers(p => p.map(t => t.id === id ? { ...t, remaining: t.remaining + secs, total: t.total + secs } : t)), [])

  return { timers, add, remove, addTime }
}

// ── Hero section ──────────────────────────────────────────────────────────────

function HeroSection({ recipe, media }) {
  const gradient = GRADIENTS[recipe.id % GRADIENTS.length]
  const primary = media.find(m => m.is_primary && m.media_type === 'image')
  const gallery = media.filter(m => !m.is_primary && m.media_type === 'image' && m.processing_status === 'ready')

  return (
    <>
      {/* Hero */}
      <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: '1.5rem', position: 'relative', height: '280px', background: primary ? undefined : gradient }}>
        {primary && (
          <img src={primary.url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '1.5rem' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 600, color: '#fff', margin: '0 0 0.5rem', textShadow: '0 2px 8px rgba(0,0,0,0.4)', lineHeight: 1.25 }}>{recipe.title}</h1>
          {recipe.description && (
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{recipe.description}</p>
          )}
        </div>
      </div>

      {/* Galerie */}
      {gallery.length > 0 && (
        <div style={{ display: 'flex', gap: '0.625rem', overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
          {gallery.map(m => (
            <img key={m.id} src={m.url} alt="" style={{ height: '100px', width: 'auto', borderRadius: 'var(--radius-input)', objectFit: 'cover', flexShrink: 0 }} />
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
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i < recipe.difficulty ? color : 'var(--border-input)', display: 'inline-block' }} />
            ))}
            <span style={{ fontSize: '0.75rem', color: 'var(--subtext)', marginLeft: '0.3rem' }}>{recipe.difficulty}/10</span>
          </div>
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

function IngredientList({ ingredients, scaleFactor, activeIds, view }) {
  const grouped = {}
  for (const ing of ingredients) {
    const key = ing.component_label || ''
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ing)
  }
  const groups = Object.entries(grouped)

  const renderIng = ing => {
    const active = activeIds.has(ing.id)
    const scaled = scaleAmount(ing.amount, scaleFactor)
    return (
      <div key={ing.id} style={{
        padding: '0.375rem 0',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: '0.5rem',
        transition: 'color 0.2s',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontWeight: active ? 600 : 400,
      }}>
        {active && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>●</span>}
        <span style={{ flex: 1, fontSize: '0.875rem' }}>{ing.name}</span>
        {(scaled || ing.unit) && (
          <span style={{ fontSize: '0.8rem', color: active ? 'var(--accent)' : 'var(--subtext)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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

function IngredientSidebar({ recipe, servings, baseServings, onServingsChange, activeIds, view, onViewChange }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
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
          <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} style={adjBtn}>−</button>
          <span style={{ fontSize: '1rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>{servings}</span>
          <button onClick={() => onServingsChange(s => s + 1)} style={adjBtn}>+</button>
        </div>
      )}

      <IngredientList
        ingredients={recipe.ingredients}
        scaleFactor={scaleFactor}
        activeIds={activeIds}
        view={view}
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

// ── Mobile ingredients drawer ─────────────────────────────────────────────────

function MobileDrawer({ recipe, servings, baseServings, onServingsChange, activeIds, onClose }) {
  const scaleFactor = baseServings ? servings / baseServings : 1
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
            <button onClick={() => onServingsChange(s => Math.max(1, s - 1))} style={adjBtn}>−</button>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>{servings}</span>
            <button onClick={() => onServingsChange(s => s + 1)} style={adjBtn}>+</button>
          </div>
        )}
        <IngredientList ingredients={recipe.ingredients} scaleFactor={scaleFactor} activeIds={activeIds} view="grouped" />
      </div>
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────

const StepCard = forwardRef(function StepCard({ step, index, isActive, onClick, onAddTimer, hasActiveTimer, stepImages }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-card)',
        marginBottom: '1rem',
        padding: '1.25rem 1.25rem 1.25rem 1.5rem',
        background: isActive ? 'color-mix(in srgb, var(--accent) 6%, var(--card))' : 'var(--card)',
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
        borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Step number */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: isActive ? 'var(--accent)' : 'var(--border-input)',
          color: isActive ? '#fff' : 'var(--subtext)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem', fontWeight: 700,
          transition: 'all 0.2s ease',
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          {/* Item 2: optionale Schritt-Überschrift */}
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
          <p style={{
            margin: step.title ? '0' : '0.2rem 0 0',
            lineHeight: 1.65,
            fontSize: '0.95rem',
            color: 'var(--text)',
          }}>{step.instruction}</p>

          {/* Step images */}
          {stepImages?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {stepImages.map(m => (
                <img key={m.id} src={m.url} alt="" style={{ height: '80px', width: 'auto', borderRadius: 'var(--radius-input)', objectFit: 'cover' }} />
              ))}
            </div>
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

// ── Timer widget ──────────────────────────────────────────────────────────────

const TimerWidget = forwardRef(function TimerWidget({ timers, expanded, onToggleExpand, onTimerClick, onAddTime, onRemove, pos, onDragStart }, ref) {
  const style = pos
    ? { position: 'fixed', left: pos.left, top: pos.top, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: '1.5rem', right: '1.5rem' }

  return (
    <div
      ref={ref}
      style={{
        ...style,
        zIndex: 400,
        background: 'var(--card)',
        borderRadius: expanded ? '16px' : '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        minWidth: expanded ? '300px' : '200px',
        maxWidth: '340px',
        overflow: 'hidden',
        transition: 'min-width 0.2s ease, border-radius 0.2s ease',
        userSelect: 'none',
      }}
    >
      {/* Drag handle / header */}
      <div
        onMouseDown={onDragStart}
        style={{
          padding: '0.625rem 0.875rem',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
        }}
      >
        <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
          ⏱ {timers.length} Timer aktiv
        </span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onToggleExpand}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          {expanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Timer list */}
      <div style={{ padding: expanded ? '0.5rem' : '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {timers.map(timer => (
          <TimerRow
            key={timer.id}
            timer={timer}
            expanded={expanded}
            onClick={() => onTimerClick(timer.id, timer.stepIdx)}
            onAddTime={onAddTime}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
})

function TimerRow({ timer, expanded, onClick, onAddTime, onRemove }) {
  const pct = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0
  const done = timer.remaining <= 0
  const color = done ? '#6B7C4E' : timer.remaining < 30 ? '#C8602A' : 'var(--accent)'

  return (
    <div style={{
      background: 'var(--bg)',
      borderRadius: '8px',
      padding: expanded ? '0.625rem 0.75rem' : '0.375rem 0.625rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '0.5rem' : '0.25rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--subtext)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {timer.label}
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 700, color, marginLeft: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
          {done ? '✓' : fmtTime(timer.remaining)}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: 'var(--border-input)', borderRadius: '2px', overflow: 'hidden', marginBottom: expanded ? '0.5rem' : 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.3s' }} />
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.375rem' }} onClick={e => e.stopPropagation()}>
          {[1, 3, 5].map(m => (
            <button key={m} onClick={() => onAddTime(timer.id, m * 60)} style={{
              padding: '0.2rem 0.45rem',
              fontSize: '0.7rem',
              border: '1px solid var(--border-input)',
              borderRadius: '4px',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--subtext)',
              fontFamily: 'Inter, sans-serif',
            }}>+{m}m</button>
          ))}
          <button onClick={() => onRemove(timer.id)} style={{
            marginLeft: 'auto',
            padding: '0.2rem 0.45rem',
            fontSize: '0.7rem',
            border: '1px solid var(--border-input)',
            borderRadius: '4px',
            background: 'none',
            cursor: 'pointer',
            color: '#C8602A',
            fontFamily: 'Inter, sans-serif',
          }}>✕</button>
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
  const isAdmin = user?.role === 'admin'
  const { timers, add: addTimer, remove: removeTimer, addTime } = useTimers()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [servings, setServings] = useState(4)
  const [stepIngredients, setStepIngredients] = useState({})
  const [ingredientView, setIngredientView] = useState('grouped')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [timerExpanded, setTimerExpanded] = useState(false)
  const [widgetPos, setWidgetPos] = useState(null)
  const [recipeMedia, setRecipeMedia] = useState([])
  const [stepMedia, setStepMedia] = useState({}) // { stepId: [media] }

  const stepRefs = useRef({})
  const widgetRef = useRef(null)
  const dragState = useRef(null)
  const lastTimerClick = useRef(null)

  // Fetch recipe + media
  useEffect(() => {
    setLoading(true)
    client.get(`/api/recipes/${id}`)
      .then(res => {
        const r = res.data
        setRecipe(r)
        setServings(r.servings || 4)
        // Load recipe media
        client.get(`/api/media/entity/recipe/${id}`)
          .then(m => setRecipeMedia(m.data))
          .catch(() => {})
        // Load step media in parallel
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

  // Widget drag
  useEffect(() => {
    const onMove = e => {
      if (!dragState.current) return
      setWidgetPos({
        left: dragState.current.startLeft + (e.clientX - dragState.current.startX),
        top: dragState.current.startTop + (e.clientY - dragState.current.startY),
      })
    }
    const onUp = () => { dragState.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const handleDragStart = e => {
    const el = widgetRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startLeft = widgetPos ? widgetPos.left : rect.left
    const startTop = widgetPos ? widgetPos.top : rect.top
    if (!widgetPos) setWidgetPos({ left: rect.left, top: rect.top })
    dragState.current = { startX: e.clientX, startY: e.clientY, startLeft, startTop }
    e.preventDefault()
  }

  const handleTimerClick = (timerId, stepIdx) => {
    if (!timerExpanded) {
      setTimerExpanded(true)
      lastTimerClick.current = timerId
    } else if (lastTimerClick.current === timerId) {
      const el = stepRefs.current[stepIdx]
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveStepIdx(stepIdx) }
      lastTimerClick.current = null
    } else {
      lastTimerClick.current = timerId
    }
  }

  if (loading) return <LoadingScreen />
  if (!recipe) return null

  const activeStep = recipe.steps[activeStepIdx]
  const activeIds = new Set((activeStep ? stepIngredients[activeStep.id] : [])?.map(i => i.id) ?? [])
  const baseServings = recipe.servings || 4

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Back nav */}
      <div style={{ padding: '0.875rem 1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', fontFamily: 'Inter, sans-serif',
          fontWeight: 500, fontSize: '0.9rem', padding: 0,
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        }}>
          ← Alle Rezepte
        </button>
        {isAdmin && recipe && (
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
          />

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile: show ingredients button */}
            <div className="md:hidden" style={{ marginBottom: '1rem' }}>
              <button onClick={() => setDrawerOpen(true)} style={{
                width: '100%', padding: '0.75rem',
                background: 'var(--card)', border: '1.5px solid var(--border-input)',
                borderRadius: 'var(--radius-input)', color: 'var(--text)',
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                fontSize: '0.925rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                🥗 Zutaten anzeigen ({recipe.ingredients.length})
              </button>
            </div>

            <HeroSection recipe={recipe} media={recipeMedia} />
            <MetaBar recipe={recipe} />

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
                  onClick={() => setActiveStepIdx(idx)}
                  onAddTimer={() => addTimer(idx, step.timer_label || step.title || `Timer ${idx + 1}`, step.timer_seconds)}
                  hasActiveTimer={timers.some(t => t.stepIdx === idx && t.remaining > 0)}
                  stepImages={(stepMedia[step.id] || []).filter(m => m.media_type === 'image' && m.processing_status === 'ready')}
                />
              ))
            )}
          </div>
        </div>
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
        />
      )}

      {/* Timer widget */}
      {timers.length > 0 && (
        <TimerWidget
          ref={widgetRef}
          timers={timers}
          expanded={timerExpanded}
          onToggleExpand={() => setTimerExpanded(e => !e)}
          onTimerClick={handleTimerClick}
          onAddTime={addTime}
          onRemove={removeTimer}
          pos={widgetPos}
          onDragStart={handleDragStart}
        />
      )}
    </div>
  )
}
