/**
 * Card / weiße Akzent-Karte (SPEC §2.4) — --surface + Holzkanten-Schatten (§1.6).
 * flat:        weicher Schatten statt Holzkante
 * pad:         Standard-Innenabstand (16px)
 * interactive: Hover-Lift (für klickbare Karten)
 * as:          Element/Component (z. B. 'a' für Links)
 * data-track-id via `trackId`.
 */
export default function Card({
  flat = false,
  pad = false,
  interactive = false,
  as: As = 'div',
  className = '',
  trackId,
  children,
  ...rest
}) {
  const cls = [
    'ui-card',
    flat ? 'ui-card--flat' : '',
    pad ? 'ui-card--pad' : '',
    interactive ? 'ui-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <As className={cls} data-track-id={trackId} {...rest}>
      {children}
    </As>
  )
}
