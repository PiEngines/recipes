/**
 * PostKachel — ein verlinkter Beitrag als kompakte Feed-Kachel (F3b-3).
 *
 * Im Entdecken-Feed steht ein Beitrag neben Rezept- und Kraut-Kacheln und muss
 * dieselbe Größe haben; der abspielbare Embed öffnet erst beim Antippen im
 * Overlay. Das ist nicht nur Layout: N eingebettete Player im Scroll bedeuten
 * N Fremd-iFrames samt Skripten. Die Kachel lädt dagegen nur ein Bild.
 *
 * Die beiden Plattformen geben unterschiedlich viel her:
 *
 * • TikTok liefert per oEmbed ein `thumbnail_url` — echtes Standbild.
 * • Instagram liefert keines (die oEmbed-Antwort ist ohne App-Token leer).
 *   Dort steht ein Marken-Platzhalter: kein kaputtes Bild, sondern eine
 *   bewusst gestaltete Fläche mit Plattform-Glyph und Autor.
 */
import { useState } from 'react'

const LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }
const AKTION = { instagram: 'Reel ansehen', tiktok: 'TikTok ansehen' }

export default function PostKachel({ post, onClick }) {
  // Auch ein vorhandenes Thumbnail kann ins Leere zeigen (CDN-URLs von TikTok
  // laufen ab) — dann greift dieselbe Fläche wie bei Instagram.
  const [bildKaputt, setBildKaputt] = useState(false)

  if (!post) return null

  const label = LABEL[post.platform] || post.platform
  const bild = !bildKaputt && post.thumbnail_url ? post.thumbnail_url : null

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      data-track-id="home-feed-post-open"
      aria-label={`${AKTION[post.platform] || label}${post.author_name ? ` von ${post.author_name}` : ''}`}
      style={{
        position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', cursor: 'pointer',
        borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-card)', background: 'var(--chalkboard)',
      }}
    >
      {bild ? (
        <img
          src={bild}
          alt={`Beitrag von ${post.author_name || label}`}
          loading="lazy"
          onError={() => setBildKaputt(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--chalkboard), var(--ink-braun))',
        }}>
          <i className={`ti ti-brand-${post.platform}`} aria-hidden="true"
            style={{ fontSize: 38, color: 'var(--on-dark)', opacity: 0.35 }} />
        </div>
      )}

      {/* Scrim: hält die Schrift unten lesbar, egal wie hell das Standbild ist. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.15) 45%, rgba(0,0,0,.1) 100%)',
      }} />

      {/* Play-Badge — das Versprechen „hier steckt ein Video dahinter". */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 42, height: 42, borderRadius: 'var(--radius-pill)',
        background: 'rgba(255,255,255,.22)', border: '1.5px solid rgba(255,255,255,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)', pointerEvents: 'none',
      }}>
        <i className="ti ti-player-play-filled" aria-hidden="true"
          style={{ fontSize: 17, color: 'var(--on-dark)', marginLeft: 2 }} />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '9px 11px', pointerEvents: 'none' }}>
        {post.author_name && (
          <p style={{
            margin: '0 0 2px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
            color: 'var(--on-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {post.author_name}
          </p>
        )}
        <p style={{
          margin: 0, display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'rgba(240,232,208,.75)',
        }}>
          <i className={`ti ti-brand-${post.platform}`} aria-hidden="true" style={{ fontSize: 12 }} />
          {AKTION[post.platform] || label}
        </p>
      </div>
    </div>
  )
}
