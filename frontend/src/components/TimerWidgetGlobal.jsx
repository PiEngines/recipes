import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimerContext } from '../context/TimerContext'

const POS_KEY = 'piengines_timer_pos'

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function clampToViewport(pos) {
  if (!pos) return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const widgetW = 300
  const widgetH = 80
  const margin = 16
  const left = Math.max(margin, Math.min(pos.left, vw - widgetW - margin))
  const top = Math.max(margin, Math.min(pos.top, vh - widgetH - margin))
  return { left, top }
}

function loadPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY))
    return clampToViewport(raw)
  } catch { return null }
}

function savePos(pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {}
}

const BTN = {
  padding: '0.2rem 0.45rem',
  fontSize: '0.7rem',
  border: '1px solid var(--border-input)',
  borderRadius: '4px',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--subtext)',
  fontFamily: 'Inter, sans-serif',
}

function TimerRow({ timer, expanded, onNavigate, onAddTime, onRemove, onPause, onResume, onReset }) {
  const pct = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0
  const done = timer.remaining <= 0
  const color = done ? '#6B7C4E' : timer.remaining < 30 ? '#C8602A' : 'var(--accent)'
  return (
    <div
      style={{ background: 'var(--bg)', borderRadius: '8px', padding: expanded ? '0.625rem 0.75rem' : '0.375rem 0.625rem', cursor: expanded ? 'pointer' : 'default', transition: 'all 0.2s' }}
      onClick={expanded ? onNavigate : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '0.5rem' : '0.25rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--subtext)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timer.label}</span>
        <span style={{ fontSize: '1rem', fontWeight: 700, color, marginLeft: '0.5rem', fontVariantNumeric: 'tabular-nums', opacity: timer.paused ? 0.5 : 1 }}>
          {done ? '✓' : (timer.paused ? '⏸ ' : '') + fmtTime(timer.remaining)}
        </span>
      </div>
      <div style={{ height: '3px', background: 'var(--border-input)', borderRadius: '2px', overflow: 'hidden', marginBottom: expanded ? '0.5rem' : 0, opacity: timer.paused ? 0.4 : 1 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.3s' }} />
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.375rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <button style={BTN} onClick={() => timer.paused ? onResume(timer.id) : onPause(timer.id)}>
            {timer.paused ? '▶' : '⏸'}
          </button>
          <button style={BTN} onClick={() => onReset(timer.id)}>↺</button>
          {[1, 3, 5].map(m => (
            <button key={m} style={BTN} onClick={() => onAddTime(timer.id, m * 60)}>+{m}m</button>
          ))}
          <button onClick={() => onRemove(timer.id)} style={{ ...BTN, marginLeft: 'auto', color: '#C8602A' }}>✕</button>
        </div>
      )}
    </div>
  )
}

export default function TimerWidgetGlobal() {
  const navigate = useNavigate()
  const { timers, remove, addTime, pause, resume, reset } = useTimerContext()
  const [expanded, setExpanded] = useState(false)
  const [pos, setPos] = useState(loadPos)
  const widgetRef = useRef(null)
  const mouseDragState = useRef(null)
  const touchDragState = useRef(null)
  const interactionStart = useRef(null)

  useEffect(() => { if (pos) savePos(pos) }, [pos])

  // Viewport boundary on resize / orientation change
  useEffect(() => {
    const handleResize = () => setPos(prev => prev ? clampToViewport(prev) : null)
    const handleOrientation = () => setTimeout(handleResize, 300)
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientation)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientation)
    }
  }, [])

  // Mouse drag
  useEffect(() => {
    const onMove = e => {
      if (!mouseDragState.current) return
      const { startX, startY, startLeft, startTop } = mouseDragState.current
      setPos(clampToViewport({ left: startLeft + (e.clientX - startX), top: startTop + (e.clientY - startY) }))
    }
    const onUp = () => {
      mouseDragState.current = null
      interactionStart.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Touch drag
  useEffect(() => {
    const onMove = e => {
      if (!touchDragState.current) return
      e.preventDefault()
      const { startX, startY, startLeft, startTop } = touchDragState.current
      setPos(clampToViewport({ left: startLeft + (e.touches[0].clientX - startX), top: startTop + (e.touches[0].clientY - startY) }))
    }
    const onEnd = () => {
      touchDragState.current = null
      interactionStart.current = null
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
  }, [])

  // Collapse on click outside when expanded
  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = e => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [expanded])

  const startMouseDrag = e => {
    const el = widgetRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startLeft = pos ? pos.left : rect.left
    const startTop = pos ? pos.top : rect.top
    if (!pos) setPos({ left: rect.left, top: rect.top })
    mouseDragState.current = { startX: e.clientX, startY: e.clientY, startLeft, startTop }
    e.preventDefault()
  }

  const startTouchDrag = e => {
    const el = widgetRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startLeft = pos ? pos.left : rect.left
    const startTop = pos ? pos.top : rect.top
    if (!pos) setPos({ left: rect.left, top: rect.top })
    touchDragState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startLeft, startTop }
  }

  // Expand on click (< 5px movement) — track start position at widget level
  const handleWidgetMouseDown = e => {
    interactionStart.current = { x: e.clientX, y: e.clientY }
  }

  const handleWidgetMouseUp = e => {
    if (!interactionStart.current) return
    const dx = e.clientX - interactionStart.current.x
    const dy = e.clientY - interactionStart.current.y
    const moved = Math.sqrt(dx * dx + dy * dy) > 5
    interactionStart.current = null
    if (!expanded && !moved) setExpanded(true)
  }

  const handleWidgetTouchStart = e => {
    interactionStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleWidgetTouchEnd = e => {
    if (!interactionStart.current || !e.changedTouches.length) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - interactionStart.current.x
    const dy = touch.clientY - interactionStart.current.y
    const moved = Math.sqrt(dx * dx + dy * dy) > 5
    interactionStart.current = null
    if (!expanded && !moved) setExpanded(true)
  }

  const handleTimerClick = timer => {
    navigate(`/recipes/${timer.recipeId}`)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scroll-to-step', { detail: { stepIdx: timer.stepIdx } }))
    }, 300)
  }

  const posStyle = pos
    ? { position: 'fixed', left: pos.left, top: pos.top, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: '1.5rem', left: '1.5rem' }

  return (
    <>
      {timers.length > 0 && (
        <div
          ref={widgetRef}
          onMouseDown={handleWidgetMouseDown}
          onMouseUp={handleWidgetMouseUp}
          onTouchStart={handleWidgetTouchStart}
          onTouchEnd={handleWidgetTouchEnd}
          style={{ ...posStyle, zIndex: 400, background: 'var(--card)', borderRadius: expanded ? '16px' : '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: expanded ? '300px' : '200px', maxWidth: '340px', overflow: 'hidden', transition: 'min-width 0.2s ease, border-radius 0.2s ease', userSelect: 'none' }}
        >
          <div
            onMouseDown={startMouseDrag}
            onTouchStart={startTouchDrag}
            onDoubleClick={() => {
              setPos(null)
              localStorage.removeItem(POS_KEY)
            }}
            style={{ padding: '0.625rem 0.875rem', background: 'var(--accent)', display: 'flex', alignItems: 'center', cursor: 'grab' }}
          >
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>⏱ {timers.length} Timer aktiv</span>
          </div>
          <div style={{ padding: expanded ? '0.5rem' : '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {timers.map(timer => (
              <TimerRow
                key={timer.id}
                timer={timer}
                expanded={expanded}
                onNavigate={() => handleTimerClick(timer)}
                onAddTime={addTime}
                onRemove={remove}
                onPause={pause}
                onResume={resume}
                onReset={reset}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
