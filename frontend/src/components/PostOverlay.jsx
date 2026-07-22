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
 * Muster wie `MediaLightbox`: abgedunkelter Hintergrund, Schließen per ✕,
 * Backdrop-Klick und Escape, Body-Scroll gesperrt.
 */
import { useEffect } from 'react'

import ExternalPostEmbed from './ExternalPostEmbed'

export default function PostOverlay({ post, onClose, onInSammlung = null }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  if (!post) return null

  return (
    <div
      onClick={onClose}
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
          anbietet (F3b-2b). */}
      {onInSammlung && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            flexShrink: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.55))',
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          }}
        >
          <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <button
              onClick={() => onInSammlung(post)}
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
          </div>
        </div>
      )}
    </div>
  )
}
