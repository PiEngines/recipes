import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import audioService from '../services/AudioService'

const TimerContext = createContext(null)

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
      if (t.paused) {
        timers.push({ ...t, remaining: t.remainingAtPause ?? 0, expired: false })
      } else {
        const remaining = Math.max(0, Math.round((t.endTime - now) / 1000))
        if (remaining === 0) {
          expired.push({ ...t, remaining: 0, expired: true })
        } else {
          timers.push({ ...t, remaining, expired: false })
        }
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
        paused: t.paused ?? false, remainingAtPause: t.remainingAtPause ?? null,
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
          if (t.paused) return { ...t, remaining: t.remainingAtPause ?? t.remaining }
          const remaining = Math.max(0, Math.round((t.endTime - now) / 1000))
          if (remaining === 0 && !t.expired) {
            newExpired.push({ ...t, remaining: 0, expired: true })
            return null
          }
          return { ...t, remaining }
        }).filter(Boolean)
        if (newExpired.length > 0) {
          audioService.play()
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
    setTimers(p => [...p, {
      id, recipeId, recipeTitle, stepIdx, label,
      total: seconds, remaining: seconds, endTime,
      expired: false, paused: false, remainingAtPause: null,
    }])
    return id
  }, [])

  const remove = useCallback(id => setTimers(p => p.filter(t => t.id !== id)), [])

  const addTime = useCallback((id, secs) => setTimers(p =>
    p.map(t => {
      if (t.id !== id) return t
      if (t.paused) {
        const newRemaining = (t.remainingAtPause ?? t.remaining) + secs
        return { ...t, remainingAtPause: newRemaining, remaining: newRemaining, total: t.total + secs }
      }
      return { ...t, remaining: t.remaining + secs, total: t.total + secs, endTime: t.endTime + secs * 1000 }
    })
  ), [])

  const pause = useCallback(id => setTimers(p =>
    p.map(t => t.id === id ? { ...t, paused: true, remainingAtPause: t.remaining } : t)
  ), [])

  const resume = useCallback(id => setTimers(p =>
    p.map(t => t.id === id
      ? { ...t, paused: false, endTime: Date.now() + (t.remainingAtPause ?? t.remaining) * 1000, remainingAtPause: null }
      : t)
  ), [])

  const reset = useCallback(id => setTimers(p =>
    p.map(t => t.id === id
      ? { ...t, paused: false, remainingAtPause: null, endTime: Date.now() + t.total * 1000, remaining: t.total }
      : t)
  ), [])

  const confirmExpired = useCallback(id => setExpiredTimers(p => p.filter(t => t.id !== id)), [])
  const confirmAllExpired = useCallback(() => setExpiredTimers([]), [])

  return (
    <TimerContext.Provider value={{
      timers, add, remove, addTime,
      pause, resume, reset,
      expiredTimers, confirmExpired, confirmAllExpired,
    }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimerContext() {
  return useContext(TimerContext)
}
