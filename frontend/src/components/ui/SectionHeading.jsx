/**
 * SectionHeading (SPEC §1.5) — Lora-italic-700-Titel + optionales
 * DM-Mono-Uppercase-Overline-Label. `rule` flankiert den Titel mit Hairlines
 * (wie „Neue Rezepte" / „Heute für dich" auf der Home).
 * label:  Overline (DM Mono, uppercase)
 * rule:   Hairline-Linien links/rechts des Titels
 * as:     Heading-Element ('h2' default)
 */
export default function SectionHeading({
  label = null,
  rule = false,
  as: As = 'h2',
  className = '',
  children,
  ...rest
}) {
  if (rule) {
    return (
      <div className={['ui-heading', 'ui-heading--rule', className].filter(Boolean).join(' ')} {...rest}>
        <span className="ui-heading__rule-line" aria-hidden="true" />
        <As className="ui-heading__title">{children}</As>
        <span className="ui-heading__rule-line" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={['ui-heading', className].filter(Boolean).join(' ')} {...rest}>
      {label && <span className="ui-heading__label">{label}</span>}
      <As className="ui-heading__title">{children}</As>
    </div>
  )
}
