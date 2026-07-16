import { useState } from 'react'

// Kanonische Rating-Sterne — rein präsentational (keine Business-Logik, kein Fetch).
const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'

function StarRow({ color, size }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block', flexShrink: 0 }}>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  )
}

export default function RatingStars({ value = 0, size = 20, interactive = false, onRate, title }) {
  const [hoverIdx, setHoverIdx] = useState(0)

  // Anzeige: fraktionale Füllung via zwei deckungsgleiche Reihen + beschnittener Wrapper.
  if (!interactive) {
    const pct = Math.max(0, Math.min(1, value / 5)) * 100
    return (
      <div title={title} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
        <StarRow color="var(--border)" size={size} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${pct}%`, overflow: 'hidden' }}>
          <StarRow color="var(--accent)" size={size} />
        </div>
      </div>
    )
  }

  // Eingabe: ganze Sterne, Hover-Preview, Klick → onRate(1..5).
  const shown = hoverIdx || value
  return (
    <div style={{ display: 'inline-flex', gap: 2, lineHeight: 0 }} onMouseLeave={() => setHoverIdx(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          width={size} height={size} viewBox="0 0 24 24"
          fill={n <= shown ? 'var(--accent)' : 'var(--border)'}
          role="button"
          aria-label={`${n} Stern${n > 1 ? 'e' : ''} vergeben`}
          onMouseEnter={() => setHoverIdx(n)}
          onClick={() => onRate?.(n)}
          style={{ display: 'block', cursor: 'pointer', flexShrink: 0 }}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  )
}
