import { useCallback, useEffect, useState } from 'react'

export default function MediaLightbox({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex)

  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!images.length) return null
  const current = images[idx]
  const hasSiblings = images.length > 1

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Counter */}
      {hasSiblings && (
        <div style={{
          position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.85rem',
          fontFamily: 'Inter, sans-serif',
          userSelect: 'none',
        }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          width: '44px', height: '44px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: 'none',
          color: '#fff',
          fontSize: '1.25rem',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}
      >×</button>

      {/* Left arrow */}
      {hasSiblings && (
        <button
          onClick={e => { e.stopPropagation(); prev() }}
          style={{
            position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >‹</button>
      )}

      {/* Image */}
      <img
        key={current.url}
        src={current.url}
        alt={current.caption || ''}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '82vh',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          userSelect: 'none',
          display: 'block',
        }}
      />

      {/* Right arrow */}
      {hasSiblings && (
        <button
          onClick={e => { e.stopPropagation(); next() }}
          style={{
            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >›</button>
      )}

      {/* Caption */}
      {current.caption && (
        <div style={{
          position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.75)',
          fontSize: '0.875rem',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          maxWidth: '70vw',
          userSelect: 'none',
          padding: '0.375rem 0.875rem',
          background: 'rgba(0,0,0,0.45)',
          borderRadius: '20px',
        }}>
          {current.caption}
        </div>
      )}
    </div>
  )
}
