/**
 * ExternalPostEmbed — abspielbarer Instagram-/TikTok-Beitrag (F3b-1).
 *
 * Das `oembed_html` der Plattformen ist ein `<blockquote>`, das erst durch das
 * jeweilige Embed-Skript zum Player wird. Zwei Dinge sind dabei wichtig:
 *
 * 1. Ein per innerHTML eingefügtes `<script>` führt der Browser **nicht** aus.
 *    Das Skript muss also selbst geladen werden — einmalig pro Plattform, nicht
 *    je Beitrag (deshalb der Modul-Cache `skriptPromises`).
 * 2. Das HTML kommt zwar von den offiziellen oEmbed-Endpunkten, ist aber
 *    Fremdinhalt. Es wird deshalb vor dem Einfügen sanitisiert.
 *
 * Lädt das Skript nicht (Adblocker, CSP, offline), bleibt der Fallback:
 * Thumbnail + Link auf den Originalbeitrag. Bis dahin steht ein Platzhalter.
 */
import DOMPurify from 'dompurify'
import { useEffect, useRef, useState } from 'react'

const SKRIPTE = {
  instagram: 'https://www.instagram.com/embed.js',
  tiktok: 'https://www.tiktok.com/embed.js',
}

const LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }

// Ein Promise je Plattform — mehrere Embeds auf einer Seite laden das Skript
// gemeinsam genau einmal.
const skriptPromises = {}

function ladeSkript(platform) {
  if (skriptPromises[platform]) return skriptPromises[platform]

  skriptPromises[platform] = new Promise((resolve, reject) => {
    const src = SKRIPTE[platform]
    if (!src) {
      reject(new Error('Unbekannte Plattform'))
      return
    }

    const vorhanden = document.querySelector(`script[src="${src}"]`)
    if (vorhanden) {
      if (vorhanden.dataset.geladen === 'ja') resolve()
      else {
        vorhanden.addEventListener('load', () => resolve())
        vorhanden.addEventListener('error', () => reject(new Error('Skript nicht geladen')))
      }
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', () => { script.dataset.geladen = 'ja'; resolve() })
    script.addEventListener('error', () => reject(new Error('Skript nicht geladen')))
    document.body.appendChild(script)
  })

  return skriptPromises[platform]
}

/** Den Player anstossen, nachdem das Markup im DOM steht. */
function verarbeite(platform) {
  if (platform === 'instagram') window.instgrm?.Embeds?.process()
  // TikTok scannt beim Laden selbst; ein erneutes Anstossen gibt es nicht.
}

// ── Platzhalter & Fallback ───────────────────────────────────────────────────

const rahmen = {
  position: 'relative',
  width: '100%',
  borderRadius: 'var(--radius-card)',
  overflow: 'hidden',
  background: 'var(--bg-alt)',
}

function Platzhalter({ hoehe = 320 }) {
  return (
    <div className="skeleton-block" style={{ ...rahmen, height: hoehe }} aria-hidden="true" />
  )
}

function Fallback({ post }) {
  const label = LABEL[post.platform] || post.platform
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      data-track-id="social-embed-fallback-open"
      style={{ ...rahmen, display: 'block', textDecoration: 'none' }}
    >
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={`Beitrag von ${post.author_name || label}`}
          style={{ width: '100%', display: 'block' }}
        />
      ) : (
        <div style={{
          height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)',
        }}>
          <i className={`ti ti-brand-${post.platform}`} aria-hidden="true" style={{ fontSize: 34 }} />
        </div>
      )}
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.04em',
        color: 'var(--text-muted)',
      }}>
        <i className={`ti ti-brand-${post.platform}`} aria-hidden="true" style={{ fontSize: 13 }} />
        Auf {label} ansehen
        <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 12 }} />
      </span>
    </a>
  )
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function ExternalPostEmbed({ post }) {
  const [status, setStatus] = useState('laedt')  // laedt | bereit | fehler
  const containerRef = useRef(null)

  const html = post?.oembed_html || null
  const platform = post?.platform

  // Kein setState im Effekt-Rumpf: der Startwert ist bereits „laedt", und ohne
  // `html` greift ohnehin der Fallback im Render.
  useEffect(() => {
    if (!html) return undefined

    let aktiv = true
    ladeSkript(platform)
      .then(() => {
        if (!aktiv) return
        setStatus('bereit')
        // Erst nach dem Render anstossen — vorher steht das Markup nicht im DOM.
        requestAnimationFrame(() => { if (aktiv) verarbeite(platform) })
      })
      .catch(() => { if (aktiv) setStatus('fehler') })

    return () => { aktiv = false }
  }, [html, platform])

  if (!html || status === 'fehler') return <Fallback post={post} />

  const sauber = DOMPurify.sanitize(html, {
    ADD_TAGS: ['blockquote', 'iframe'],
    ADD_ATTR: ['allowfullscreen', 'allow', 'frameborder', 'scrolling', 'data-instgrm-permalink',
               'data-instgrm-version', 'data-video-id', 'cite'],
  })

  return (
    <>
      {status === 'laedt' && <Platzhalter />}
      <div
        ref={containerRef}
        // Fremd-HTML von den offiziellen oEmbed-Endpunkten — sanitisiert (s. o.).
        dangerouslySetInnerHTML={{ __html: sauber }}
        style={{ display: status === 'bereit' ? 'block' : 'none' }}
      />
    </>
  )
}
