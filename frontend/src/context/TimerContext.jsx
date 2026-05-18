import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const TimerContext = createContext(null)

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

const STORAGE_KEY = 'piengines_timers'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { timers: [], expired: [] }
    const saved = JSON.parse(raw)
    const now = Date.now()
    const timers = []
    const expired = []
    for (const t of saved) {
      const remaining = Math.max(0, Math.round((t.endTime - now) / 1000))
      if (remaining === 0) {
        expired.push({ ...t, remaining: 0, expired: true })
      } else {
        timers.push({ ...t, remaining, expired: false })
      }
    }
    return { timers, expired }
  } catch {
    return { timers: [], expired: [] }
  }
}

function persistTimers(timers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      timers.map(t => ({
        id: t.id, recipeId: t.recipeId, recipeTitle: t.recipeTitle,
        stepIdx: t.stepIdx, label: t.label, total: t.total, endTime: t.endTime,
      }))
    ))
  } catch {}
}

export function TimerProvider({ children }) {
  const { timers: init, expired: initExpired } = loadFromStorage()
  const allInitIds = [...init, ...initExpired].map(t => t.id)
  const nextId = useRef(allInitIds.length > 0 ? Math.max(...allInitIds) + 1 : 1)

  const [timers, setTimers] = useState(init)
  const [expiredTimers, setExpiredTimers] = useState(initExpired)

  useEffect(() => { persistTimers(timers) }, [timers])

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now()
      setTimers(prev => {
        const newExpired = []
        const active = prev.map(t => {
          const remaining = Math.max(0, Math.round((t.endTime - now) / 1000))
          if (remaining === 0 && !t.expired) {
            newExpired.push({ ...t, remaining: 0, expired: true })
            return null
          }
          return { ...t, remaining }
        }).filter(Boolean)
        if (newExpired.length > 0) {
          playBeep()
          setExpiredTimers(p => [...p, ...newExpired])
          persistTimers(active)
        }
        return active
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const add = useCallback((recipeId, recipeTitle, stepIdx, label, seconds) => {
    const id = nextId.current++
    const endTime = Date.now() + seconds * 1000
    setTimers(p => [...p, { id, recipeId, recipeTitle, stepIdx, label, total: seconds, remaining: seconds, endTime, expired: false }])
    return id
  }, [])

  const remove = useCallback(id => setTimers(p => p.filter(t => t.id !== id)), [])

  const addTime = useCallback((id, secs) => setTimers(p =>
    p.map(t => t.id === id ? { ...t, remaining: t.remaining + secs, total: t.total + secs, endTime: t.endTime + secs * 1000 } : t)
  ), [])

  const confirmExpired = useCallback(id => setExpiredTimers(p => p.filter(t => t.id !== id)), [])
  const confirmAllExpired = useCallback(() => setExpiredTimers([]), [])

  return (
    <TimerContext.Provider value={{ timers, add, remove, addTime, expiredTimers, confirmExpired, confirmAllExpired }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimerContext() {
  return useContext(TimerContext)
}
