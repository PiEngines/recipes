import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimerContext } from '../context/TimerContext'

const POS_KEY = 'piengines_timer_pos'

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function loadPos() {
  try { return JSON.parse(localStorage.getItem(POS_KEY)) } catch { return null }
}

function savePos(pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {}
}

function TimerRow({ timer, expanded, onClick, onAddTime, onRemove }) {
  const pct = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0
  const done = timer.remaining <= 0
  const color = done ? '#6B7C4E' : timer.remaining < 30 ? '#C8602A' : 'var(--accent)'
  return (
    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: expanded ? '0.625rem 0.75rem' : '0.375rem 0.625rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '0.5rem' : '0.25rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--subtext)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timer.label}</span>
        <span style={{ fontSize: '1rem', fontWeight: 700, color, marginLeft: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>{done ? '✓' : fmtTime(timer.remaining)}</span>
      </div>
      <div style={{ height: '3px', background: 'var(--border-input)', borderRadius: '2px', overflow: 'hidden', marginBottom: expanded ? '0.5rem' : 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.3s' }} />
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.375rem' }} onClick={e => e.stopPropagation()}>
          {[1, 3, 5].map(m => (
            <button key={m} onClick={() => onAddTime(timer.id, m * 60)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', border: '1px solid var(--border-input)', borderRadius: '4px', background: 'none', cursor: 'pointer', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>+{m}m</button>
          ))}
          <button onClick={() => onRemove(timer.id)} style={{ marginLeft: 'auto', padding: '0.2rem 0.45rem', fontSize: '0.7rem', border: '1px solid var(--border-input)', borderRadius: '4px', background: 'none', cursor: 'pointer', color: '#C8602A', fontFamily: 'Inter, sans-serif' }}>✕</button>
        </div>
      )}
    </div>
  )
}

export default function TimerWidgetGlobal() {
  const navigate = useNavigate()
  const { timers, remove, addTime } = useTimerContext()
  const [expanded, setExpanded] = useState(false)
  const [pos, setPos] = useState(loadPos)
  // ExpiredTimerModal moved to NotificationsModal (App.jsx)
  const widgetRef = useRef(null)
  const mouseDragState = useRef(null)
  const touchDragState = useRef(null)

  useEffect(() => { if (pos) savePos(pos) }, [pos])

  // Mouse drag
  useEffect(() => {
    const onMove = e => {
      if (!mouseDragState.current) return
      const { startX, startY, startLeft, startTop } = mouseDragState.current
      setPos({ left: startLeft + (e.clientX - startX), top: startTop + (e.clientY - startY) })
    }
    const onUp = () => { mouseDragState.current = null }
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
      setPos({ left: startLeft + (e.touches[0].clientX - startX), top: startTop + (e.touches[0].clientY - startY) })
    }
    const onEnd = () => { touchDragState.current = null }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
  }, [])

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

  const handleTimerClick = (timer) => {
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
      {/* Timer widget */}
      {timers.length > 0 && (
        <div
          ref={widgetRef}
          style={{ ...posStyle, zIndex: 400, background: 'var(--card)', borderRadius: expanded ? '16px' : '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: expanded ? '300px' : '200px', maxWidth: '340px', overflow: 'hidden', transition: 'min-width 0.2s ease, border-radius 0.2s ease', userSelect: 'none' }}
        >
          <div
            onMouseDown={startMouseDrag}
            onTouchStart={startTouchDrag}
            style={{ padding: '0.625rem 0.875rem', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab' }}
          >
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>⏱ {timers.length} Timer aktiv</span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {expanded ? '▼' : '▲'}
            </button>
          </div>
          <div style={{ padding: expanded ? '0.5rem' : '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {timers.map(timer => (
              <TimerRow
                key={timer.id}
                timer={timer}
                expanded={expanded}
                onClick={() => handleTimerClick(timer)}
                onAddTime={addTime}
                onRemove={remove}
              />
            ))}
          </div>
        </div>
      )}

    </>
  )
}
