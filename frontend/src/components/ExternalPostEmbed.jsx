/**
 * ExternalPostEmbed — abspielbarer Instagram-/TikTok-Beitrag (F3b-1).
 *
 * Die beiden Plattformen werden bewusst **unterschiedlich** eingebettet:
 *
 * • Instagram → direkter iFrame auf `…/{typ}/{code}/embed/`.
 *   Instagrams eigenes `embed.js` antwortet in der Praxis mit HTTP 503,
 *   `window.instgrm` bleibt dann undefiniert und der Beitrag wird nie zum
 *   Player verarbeitet. Der Embed-iFrame umgeht das Skript komplett und
 *   braucht kein `window.instgrm`. `oembed_html` wird für Instagram deshalb
 *   ignoriert (das Backend speichert es weiter — schadet nicht).
 *
 * • TikTok → `oembed_html` (ein `<blockquote>`) plus `embed.js`. Dort
 *   funktioniert das Skript zuverlässig. Zwei Dinge sind dabei wichtig:
 *   ein per innerHTML eingefügtes `<script>` führt der Browser nicht aus (das
 *   Skript wird also selbst geladen, einmalig pro Plattform), und das
 *   Fremd-HTML wird vor dem Einfügen sanitisiert.
 *
 * Klappt beides nicht (Adblocker, CSP, nicht parsebare URL), bleibt der
 * Fallback: Thumbnail + Link auf den Originalbeitrag.
 */
import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'

const SKRIPTE = {
  tiktok: 'https://www.tiktok.com/embed.js',
}

const LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }

// Pfad-Typen, die Instagram einbetten kann → normalisierte Embed-Form.
const IG_TYPEN = { reel: 'reel', reels: 'reel', p: 'p', tv: 'tv' }

// Reels sind hochkant, Feed-Posts eher quadratisch.
const IG_HOEHEN = { reel: 640, p: 500, tv: 640 }

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

/**
 * Embed-Ziel aus einer Instagram-URL ableiten.
 *
 * Gesucht wird ein Pfadsegment `reel|reels|p|tv`, gefolgt vom Shortcode —
 * die Suche läuft über alle Segmente, weil Links auch in der Form
 * `/{username}/reel/{code}/` vorkommen. Der Query-String fällt weg, da nur
 * `pathname` ausgewertet wird (`…/reel/DX1/?igsh=…` → `reel` + `DX1`).
 *
 * @returns {{src: string, hoehe: number} | null} `null`, wenn nicht parsebar.
 */
function instagramEmbed(url) {
  let pfad
  try {
    pfad = new URL(String(url).trim()).pathname
  } catch {
    return null
  }

  const segmente = pfad.split('/').filter(Boolean)
  for (let i = 0; i < segmente.length - 1; i++) {
    const typ = IG_TYPEN[segmente[i].toLowerCase()]
    const code = segmente[i + 1]
    if (typ && /^[A-Za-z0-9_-]+$/.test(code)) {
      return { src: `https://www.instagram.com/${typ}/${code}/embed/`, hoehe: IG_HOEHEN[typ] }
    }
  }
  return null
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

// ── Instagram: direkter Embed-iFrame ─────────────────────────────────────────

function InstagramEmbed({ post }) {
  const [fehlgeschlagen, setFehlgeschlagen] = useState(false)
  const [geladen, setGeladen] = useState(false)
  const embed = useMemo(() => instagramEmbed(post?.url || ''), [post?.url])

  if (!embed || fehlgeschlagen) return <Fallback post={post} />

  return (
    <div style={{ ...rahmen, height: embed.hoehe }}>
      {/* Der Platzhalter liegt über dem iFrame statt ihn zu verstecken:
          ein `display:none`-iFrame hat keine Box, womit `loading="lazy"`
          das Laden gar nicht erst anstösst. */}
      {!geladen && (
        <div className="skeleton-block" style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
      )}
      <iframe
        src={embed.src}
        title={`Beitrag von ${post.author_name || 'Instagram'}`}
        scrolling="no"
        frameBorder="0"
        allowTransparency="true"
        allowFullScreen
        loading="lazy"
        onLoad={() => setGeladen(true)}
        onError={() => setFehlgeschlagen(true)}
        data-track-id="social-embed-instagram"
        style={{
          width: '100%', height: '100%', border: 0, display: 'block',
          opacity: geladen ? 1 : 0, transition: 'opacity .2s ease',
        }}
      />
    </div>
  )
}

// ── TikTok: oEmbed-HTML + Embed-Skript ───────────────────────────────────────

function SkriptEmbed({ post }) {
  const [status, setStatus] = useState('laedt')  // laedt | bereit | fehler

  const html = post?.oembed_html || null
  const platform = post?.platform

  // Kein setState im Effekt-Rumpf: der Startwert ist bereits „laedt", und ohne
  // `html` greift ohnehin der Fallback im Render.
  useEffect(() => {
    if (!html) return undefined

    let aktiv = true
    ladeSkript(platform)
      .then(() => { if (aktiv) setStatus('bereit') })
      .catch(() => { if (aktiv) setStatus('fehler') })

    return () => { aktiv = false }
  }, [html, platform])

  if (!html || status === 'fehler') return <Fallback post={post} />

  const sauber = DOMPurify.sanitize(html, {
    ADD_TAGS: ['blockquote', 'iframe'],
    ADD_ATTR: ['allowfullscreen', 'allow', 'frameborder', 'scrolling',
               'data-video-id', 'cite'],
  })

  return (
    <>
      {status === 'laedt' && <Platzhalter />}
      <div
        // Fremd-HTML vom offiziellen oEmbed-Endpunkt — sanitisiert (s. o.).
        dangerouslySetInnerHTML={{ __html: sauber }}
        style={{ display: status === 'bereit' ? 'block' : 'none' }}
      />
    </>
  )
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function ExternalPostEmbed({ post }) {
  if (post?.platform === 'instagram') return <InstagramEmbed post={post} />
  return <SkriptEmbed post={post} />
}
