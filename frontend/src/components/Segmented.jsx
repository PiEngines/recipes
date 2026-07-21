/**
 * Segmented Control (SPEC §2.9) — Tab- und Segment-Umschalter.
 *
 * `dark` für den Einsatz auf dem dunklen Profil-Kopf (Braun-Welt), sonst die
 * helle Variante auf `--bg-alt`.
 */
export default function Segmented({ items, value, onChange, ariaLabel, trackId, dark = false }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        borderRadius: 'var(--radius-tag)',
        background: dark ? 'rgba(255,255,255,.08)' : 'var(--bg-alt)',
      }}
    >
      {items.map(item => {
        const aktiv = value === item.key
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={aktiv}
            onClick={() => onChange(item.key)}
            data-track-id={trackId}
            style={{
              flex: 1,
              padding: '7px 10px',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--radius-tag)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.05em',
              fontWeight: aktiv ? 600 : 400,
              whiteSpace: 'nowrap',
              background: aktiv ? (dark ? 'var(--on-dark)' : 'var(--surface)') : 'transparent',
              color: aktiv
                ? (dark ? 'var(--ink-braun)' : 'var(--text)')
                : (dark ? 'rgba(240,232,208,.5)' : 'var(--text-muted)'),
            }}
          >
            {item.label}
            {item.badge != null && (
              <span style={{ marginLeft: 5, opacity: 0.65 }}>{item.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
