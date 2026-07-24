// Generischer einklappbarer Block: Titel + Chevron + optionaler Zähler.
// Ein Reveal-Muster für alle Sammel-Ansichten (Favoriten-Block auf /favorites
// und im Profil-„Gespeichert"-Tab). Sammlungen bringen ihren eigenen Kopf über
// `SammlungAccordion` mit — die brauchen diesen Wrapper nicht.
import { useState } from 'react'

export default function AccordionSection({ title, count, defaultOpen = true, trackId, id, ariaLabel, children }) {
  const [offen, setOffen] = useState(defaultOpen)

  return (
    <section
      id={id}
      aria-label={ariaLabel || title}
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}
    >
      <button
        onClick={() => setOffen(o => !o)}
        data-track-id={trackId}
        aria-expanded={offen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <i className={`ti ti-chevron-${offen ? 'down' : 'right'}`} aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {count != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {count}
          </span>
        )}
      </button>

      {offen && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {children}
        </div>
      )}
    </section>
  )
}
