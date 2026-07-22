/**
 * ExternalPostEmbed — abspielbarer Instagram-/TikTok-Beitrag (F3b-1).
 *
 * Beide Plattformen werden als **direkter Embed-iFrame** eingebettet — die
 * plattform-eigenen `embed.js`-Skripte sind für eine SPA unbrauchbar:
 *
 * • Instagram → `…/{typ}/{code}/embed/`. Instagrams `embed.js` antwortet in der
 *   Praxis mit HTTP 503, `window.instgrm` bleibt dann undefiniert und der
 *   Beitrag wird nie zum Player verarbeitet.
 *
 * • TikTok → `…/embed/v2/{videoId}`. TikToks `embed.js` upgradet das
 *   `<blockquote>` aus `oembed_html` nur beim **ersten** Skript-Lauf und bietet
 *   keine Re-Process-API. Bei jedem erneuten Mount (z. B. Overlay öffnen) blieb
 *   deshalb statisches HTML stehen — ein Tap sprang in die TikTok-App.
 *
 * `oembed_html` wird nur noch als Fallback-Quelle für die Video-ID gelesen (das
 * Backend speichert es weiter — schadet nicht). Klappt der Embed nicht
 * (Adblocker, CSP, nicht parsebare URL), bleibt der Fallback: Thumbnail + Link
 * auf den Originalbeitrag.
 */
import { useMemo, useState } from 'react'

const LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }

// Pfad-Typen, die Instagram einbetten kann → normalisierte Embed-Form.
const IG_TYPEN = { reel: 'reel', reels: 'reel', p: 'p', tv: 'tv' }

// Reels sind hochkant, Feed-Posts eher quadratisch.
const IG_HOEHEN = { reel: 640, p: 500, tv: 640 }

// TikTok ist durchgängig hochkant; der v2-Player bringt zusätzlich eine
// Kopfzeile mit Autor und eine Fußzeile mit Beschreibung mit.
const TT_HOEHE = 760

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

/**
 * Embed-Ziel aus einer TikTok-URL ableiten.
 *
 * Primär aus der URL (`…/@user/video/{id}`). Kurzlinks (`vm.tiktok.com/XYZ`)
 * tragen die ID nicht im Pfad — dort greift das `oembed_html` des Backends, in
 * dem TikTok die ID als `data-video-id` mitliefert.
 *
 * @returns {{src: string, hoehe: number} | null} `null`, wenn keine ID findbar.
 */
function tiktokEmbed(url, oembedHtml) {
  const ausUrl = String(url || '').match(/\/video\/(\d+)/)
  const ausHtml = String(oembedHtml || '').match(/data-video-id="(\d+)"/)
  const videoId = ausUrl?.[1] || ausHtml?.[1]
  if (!videoId) return null
  return { src: `https://www.tiktok.com/embed/v2/${videoId}`, hoehe: TT_HOEHE }
}

// ── Platzhalter & Fallback ───────────────────────────────────────────────────

const rahmen = {
  position: 'relative',
  width: '100%',
  borderRadius: 'var(--radius-card)',
  overflow: 'hidden',
  background: 'var(--bg-alt)',
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

// ── TikTok: direkter Embed-iFrame ────────────────────────────────────────────

function TikTokEmbed({ post }) {
  const [fehlgeschlagen, setFehlgeschlagen] = useState(false)
  const [geladen, setGeladen] = useState(false)
  const embed = useMemo(
    () => tiktokEmbed(post?.url || '', post?.oembed_html || ''),
    [post?.url, post?.oembed_html],
  )

  if (!embed || fehlgeschlagen) return <Fallback post={post} />

  return (
    <div style={{ ...rahmen, height: embed.hoehe }}>
      {/* Platzhalter über dem iFrame — siehe InstagramEmbed. */}
      {!geladen && (
        <div className="skeleton-block" style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
      )}
      <iframe
        src={embed.src}
        title={`Beitrag von ${post.author_name || 'TikTok'}`}
        scrolling="no"
        frameBorder="0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        onLoad={() => setGeladen(true)}
        onError={() => setFehlgeschlagen(true)}
        data-track-id="social-embed-tiktok"
        style={{
          width: '100%', height: '100%', border: 0, display: 'block',
          opacity: geladen ? 1 : 0, transition: 'opacity .2s ease',
        }}
      />
    </div>
  )
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function ExternalPostEmbed({ post }) {
  if (post?.platform === 'instagram') return <InstagramEmbed post={post} />
  if (post?.platform === 'tiktok') return <TikTokEmbed post={post} />
  return <Fallback post={post} />
}
