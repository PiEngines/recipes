/**
 * PostOverlay — der abspielbare Beitrag, geöffnet aus einer `PostKachel`.
 *
 * Erst hier entsteht der eigentliche Embed: `ExternalPostEmbed` wird mit dem
 * Overlay montiert, lädt den Player-iFrame also genau dann, wenn jemand den
 * Beitrag wirklich sehen will — nicht schon beim Scrollen durch den Feed.
 *
 * Zwei Zonen: oben die Media-Zone, die den Rest des Platzes bekommt und bei
 * Bedarf selbst scrollt (Reels sind hochkant und oft höher als der Viewport),
 * unten eine fest verankerte Aktionszone. Die Aktion liegt bewusst *nicht* im
 * Scroll-Fluss — sonst schiebt der Player sie unter die Falz und man muss am
 * Video vorbeiscrollen, um sie zu erreichen.
 *
 * `inSammlung` blendet die Aktion ein. Der Picker öffnet dann *hier* als
 * Bottom-Sheet in derselben Zone, statt als zweites Fullscreen-Overlay: der
 * Beitrag bleibt sichtbar, während man die Sammlung wählt.
 *
 * Muster wie `MediaLightbox`: abgedunkelter Hintergrund, Schließen per ✕,
 * Backdrop-Klick und Escape, Body-Scroll gesperrt. Escape und Backdrop wirken
 * gestaffelt — offenes Sheet zuerst, erst danach das Overlay.
 */
import { useEffect, useState } from 'react'

import CollectionPicker from './CollectionPicker'
import ExternalPostEmbed from './ExternalPostEmbed'

export default function PostOverlay({ post, onClose, inSammlung = false }) {
  const [sheetOffen, setSheetOffen] = useState(false)

  // Eine Ebene zurück: erst das Sheet, dann das Overlay.
  const zurueck = () => {
    if (sheetOffen) setSheetOffen(false)
    else onClose()
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (sheetOffen) setSheetOffen(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sheetOffen])

  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  if (!post) return null

  return (
    <div
      onClick={zurueck}
      role="dialog"
      aria-modal="true"
      aria-label="Verlinkter Beitrag"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.9)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <button
        onClick={onClose}
        data-track-id="home-feed-post-close"
        aria-label="Schließen"
        style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 2,
          width: 44, height: 44, borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,255,255,.12)', border: 'none',
          color: 'var(--on-dark)', fontSize: '1.25rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {/* Media-Zone: nimmt den Platz oberhalb der Aktionszone ein und scrollt
          selbst, wenn der Player höher ist. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '64px 16px 16px' }}>
        {/* Klicks im Inhalt dürfen das Overlay nicht schließen — sonst wäre der
            Player nicht bedienbar. */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}
        >
          <ExternalPostEmbed post={post} />
        </div>
      </div>

      {/* Aktionszone: am Overlay-Boden verankert, damit die Aktion unabhängig
          von der Player-Höhe erreichbar bleibt. Nur wo der Aufrufer sie
          anbietet (F3b-2b). Offen zeigt sie die Sammlungsliste, sonst nur den
          Button — die Steuerleiste des Players bleibt so frei. */}
      {inSammlung && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            flexShrink: 0,
            background: sheetOffen
              ? 'var(--surface)'
              : 'linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.55))',
            borderTop: sheetOffen ? '1px solid var(--hairline)' : 'none',
            borderRadius: sheetOffen ? 'var(--radius-card) var(--radius-card) 0 0' : 0,
            padding: sheetOffen
              ? '1.25rem 1rem calc(1rem + env(safe-area-inset-bottom))'
              : '12px 16px calc(12px + env(safe-area-inset-bottom))',
            maxHeight: sheetOffen ? '62vh' : undefined,
            display: sheetOffen ? 'flex' : 'block',
            flexDirection: 'column',
          }}
        >
          <div style={{
            maxWidth: 560, margin: '0 auto', width: '100%',
            display: 'flex', flexDirection: 'column', minHeight: 0,
            ...(sheetOffen ? { flex: 1 } : null),
          }}>
            {sheetOffen ? (
              <CollectionPicker
                embedded
                itemType="external_post"
                itemId={post.id}
                onClose={() => setSheetOffen(false)}
              />
            ) : (
              <button
                onClick={() => setSheetOffen(true)}
                data-track-id="post-overlay-in-sammlung"
                style={{
                  width: '100%', padding: '11px 16px',
                  borderRadius: 'var(--radius-input)', cursor: 'pointer',
                  background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.3)',
                  color: 'var(--on-dark)',
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <i className="ti ti-books" aria-hidden="true" style={{ fontSize: 15 }} /> In Sammlung
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
