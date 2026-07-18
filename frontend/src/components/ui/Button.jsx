/**
 * Button — kanonischer Wahl-2.0-Button (SPEC §1.6).
 * variant: 'primary' (Terrakotta + gedruckte Unterkante) · 'secondary' · 'ghost'
 * size:    'sm' | 'md'   ·   full: volle Breite   ·   leftIcon/rightIcon: ReactNode
 * data-track-id via `trackId` (GTM) — oder direkt als Prop durchgereicht.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  leftIcon = null,
  rightIcon = null,
  as: As = 'button',
  className = '',
  trackId,
  children,
  ...rest
}) {
  const cls = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    full ? 'ui-btn--full' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <As className={cls} data-track-id={trackId} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </As>
  )
}
