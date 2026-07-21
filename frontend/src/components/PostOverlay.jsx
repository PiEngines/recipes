/**
 * PostOverlay — der abspielbare Beitrag, geöffnet aus einer `PostKachel`.
 *
 * Erst hier entsteht der eigentliche Embed: `ExternalPostEmbed` wird mit dem
 * Overlay montiert, lädt also Instagram-iFrame bzw. TikTok-`embed.js` genau
 * dann, wenn jemand den Beitrag wirklich sehen will — nicht schon beim
 * Scrollen durch den Feed.
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
        // Der Player ist oft höher als der Viewport (Reels sind hochkant) —
        // das Overlay scrollt deshalb selbst, statt ihn abzuschneiden.
        overflowY: 'auto',
        padding: '64px 16px 32px',
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

      {/* Klicks im Inhalt dürfen das Overlay nicht schließen — sonst wäre der
          Player nicht bedienbar. */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}
      >
        <ExternalPostEmbed post={post} />

        {/* Optionale Aktion — nur wo der Aufrufer sie anbietet (F3b-2b). */}
        {onInSammlung && (
          <button
            onClick={() => onInSammlung(post)}
            data-track-id="post-overlay-in-sammlung"
            style={{
              marginTop: 12, width: '100%', padding: '11px 16px',
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
  )
}
