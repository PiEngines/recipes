import { useCallback, useEffect, useRef, useState } from 'react'

const ANIM_MS = 250

export default function MediaLightbox({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const [prevIdx, setPrevIdx] = useState(null)
  const [direction, setDirection] = useState(null) // 'left' | 'right'
  const [isAnimating, setIsAnimating] = useState(false)
  const animTimer = useRef(null)
  const touchStartX = useRef(null)

  const navigate = useCallback((dir) => {
    if (isAnimating || images.length <= 1) return
    setDirection(dir)
    setPrevIdx(idx)
    setIdx(i => dir === 'left' ? (i + 1) % images.length : (i - 1 + images.length) % images.length)
    setIsAnimating(true)
    clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => {
      setIsAnimating(false)
      setPrevIdx(null)
    }, ANIM_MS)
  }, [isAnimating, idx, images.length])

  const prev = useCallback(() => navigate('right'), [navigate])
  const next = useCallback(() => navigate('left'), [navigate])

  useEffect(() => () => clearTimeout(animTimer.current), [])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  if (!images.length) return null
  const current = images[idx]
  const hasSiblings = images.length > 1

  const imgStyle = {
    position: 'absolute',
    maxWidth: '90vw',
    maxHeight: '82vh',
    objectFit: 'contain',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: '8px',
    userSelect: 'none',
  }

  return (
    <div
      onClick={onClose}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const delta = e.changedTouches[0].clientX - touchStartX.current
        if (delta > 50) prev()
        else if (delta < -50) next()
      }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes lb-out-left  { from{transform:translate(-50%,-50%) translateX(0)}    to{transform:translate(-50%,-50%) translateX(-105vw)} }
        @keyframes lb-out-right { from{transform:translate(-50%,-50%) translateX(0)}    to{transform:translate(-50%,-50%) translateX(105vw)}  }
        @keyframes lb-in-right  { from{transform:translate(-50%,-50%) translateX(105vw)} to{transform:translate(-50%,-50%) translateX(0)}      }
        @keyframes lb-in-left   { from{transform:translate(-50%,-50%) translateX(-105vw)} to{transform:translate(-50%,-50%) translateX(0)}     }
      `}</style>

      {/* Counter */}
      {hasSiblings && (
        <div style={{
          position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif',
          userSelect: 'none', zIndex: 2,
        }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem', zIndex: 2,
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', border: 'none',
          color: '#fff', fontSize: '1.25rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {/* Left arrow */}
      {hasSiblings && (
        <button
          onClick={e => { e.stopPropagation(); prev() }}
          disabled={isAnimating}
          style={{
            position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            color: '#fff', fontSize: '1.5rem', cursor: isAnimating ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isAnimating ? 0.4 : 1, transition: 'opacity 0.1s',
          }}
        >‹</button>
      )}

      {/* Outgoing image (during animation) */}
      {isAnimating && prevIdx !== null && (
        <img
          key={`out-${prevIdx}`}
          src={images[prevIdx].url}
          alt=""
          onClick={e => e.stopPropagation()}
          style={{
            ...imgStyle,
            animation: `${direction === 'left' ? 'lb-out-left' : 'lb-out-right'} ${ANIM_MS}ms ease forwards`,
            zIndex: 1,
          }}
        />
      )}

      {/* Current image */}
      <img
        key={`in-${idx}`}
        src={current.url}
        alt={current.caption || ''}
        onClick={e => e.stopPropagation()}
        style={{
          ...imgStyle,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          animation: isAnimating
            ? `${direction === 'left' ? 'lb-in-right' : 'lb-in-left'} ${ANIM_MS}ms ease forwards`
            : 'none',
          zIndex: 2,
        }}
      />

      {/* Right arrow */}
      {hasSiblings && (
        <button
          onClick={e => { e.stopPropagation(); next() }}
          disabled={isAnimating}
          style={{
            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            color: '#fff', fontSize: '1.5rem', cursor: isAnimating ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isAnimating ? 0.4 : 1, transition: 'opacity 0.1s',
          }}
        >›</button>
      )}

      {/* Caption */}
      {current.caption && (
        <div style={{
          position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 3,
          color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
          textAlign: 'center', maxWidth: '70vw', userSelect: 'none',
          padding: '0.375rem 0.875rem', background: 'rgba(0,0,0,0.45)', borderRadius: '20px',
        }}>
          {current.caption}
        </div>
      )}
    </div>
  )
}
