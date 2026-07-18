/**
 * Input / Suchfeld — kanonisches Wahl-2.0-Textfeld.
 * label:  optionales DM-Mono-Uppercase-Label darüber
 * icon:   optionales führendes Icon (ReactNode) → Suchfeld-Variante
 * error:  Fehlermeldung (deutsch) → roter Rahmen + Hinweiszeile
 * Alle weiteren Props (value, onChange, placeholder, type, data-track-id …)
 * gehen direkt an das <input>.
 */
export default function Input({
  label = null,
  icon = null,
  error = null,
  className = '',
  trackId,
  id,
  ...rest
}) {
  const inputCls = [
    'ui-input',
    icon ? 'ui-input--with-icon' : '',
    error ? 'ui-input--error' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <label className="ui-field">
      {label && <span className="ui-field__label">{label}</span>}
      <span className="ui-input-wrap">
        {icon && <span className="ui-input__icon" aria-hidden="true">{icon}</span>}
        <input
          id={id}
          className={inputCls}
          data-track-id={trackId}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
      </span>
      {error && <span className="ui-field__error">{error}</span>}
    </label>
  )
}
