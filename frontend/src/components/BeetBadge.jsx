/**
 * BeetBadge — „+"/„✓" auf einer Pflanzen-Kachel, legt die Pflanze ins Beet.
 *
 * Sitzt in der Bildfläche oben rechts, an derselben Stelle wie das Herz auf
 * Rezeptkarten. Die Kacheln sind `<Link>`s — der Tap darf deshalb weder
 * navigieren noch nach oben durchschlagen.
 */
import { useBeet } from '../context/BeetContext'

export default function BeetBadge({ slug, name, style = {} }) {
  const beet = useBeet()
  if (!beet || !slug) return null

  const drin = beet.slugs.has(slug)

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); beet.umschalten(slug, name) }}
      title={drin ? 'Aus dem Beet entfernen' : 'Ins Beet legen'}
      aria-label={drin ? 'Aus dem Beet entfernen' : 'Ins Beet legen'}
      aria-pressed={drin}
      data-track-id="plant-beet-toggle"
      style={{
        position: 'absolute', top: 6, right: 6,
        width: 26, height: 26, padding: 0, flexShrink: 0,
        borderRadius: 'var(--radius-pill)',
        // Ohne Beet-Zugehörigkeit ein dunkler Kreis wie beim Herz (das Bild
        // dahinter liefert den Kontrast), mit Zugehörigkeit grün gefüllt.
        background: drin ? 'var(--green)' : 'rgba(0,0,0,.42)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--on-accent)',
        transition: 'background .15s ease',
        ...style,
      }}
    >
      <i className={`ti ${drin ? 'ti-check' : 'ti-plus'}`} aria-hidden="true" style={{ fontSize: 15 }} />
    </button>
  )
}
