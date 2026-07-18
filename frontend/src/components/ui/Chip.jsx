/**
 * Chip / Pill (SPEC §2.10) — Grundlage für Filter-Pills und Zutaten-Chips.
 * variant:  'default' | 'floating' (weiße Pill mit Schatten) | 'dark' | 'accent'
 * dotColor: optionaler Kategorie-Farbpunkt (CSS-Farbe/Token) im Slot links
 *           → aus theme/categoryColors.js: getCategoryColor(cat).base
 * onRemove: falls gesetzt → ✕-Variante (eigener Klickbereich, stopPropagation)
 * data-track-id via `trackId`.
 */
export default function Chip({
  variant = 'default',
  dotColor = null,
  onRemove = null,
  as: As = 'span',
  className = '',
  trackId,
  children,
  ...rest
}) {
  const cls = ['ui-chip', `ui-chip--${variant}`, className].filter(Boolean).join(' ')

  return (
    <As className={cls} data-track-id={trackId} {...rest}>
      {dotColor && <span className="ui-chip__dot" style={{ background: dotColor }} aria-hidden="true" />}
      {children}
      {onRemove && (
        <span
          className="ui-chip__x"
          role="button"
          aria-label="Entfernen"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(e) }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      )}
    </As>
  )
}
