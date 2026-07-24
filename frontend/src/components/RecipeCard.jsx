import FavoriteHeart from './FavoriteHeart'
import { getCategoryColor, categoryGradient } from '../theme/categoryColors'

// Foto-Kachel (Wahl 2.0 · SPEC §2.1): Titel auf dem Bild (Lora italic), Kategorie·Zeit-
// Chip oben links, Herz oben rechts, Autor + ★ unten. Fallback ohne Foto = identische
// Kachel mit Kategorie-Farbblock + Glyph (Layout bleibt stabil).
// Prop-Vertrag stabil: { recipe, onClick, dimmed }. Optional (abwärtskompatibel):
//   variant='default'|'featured' (16:9) · image (aufgelöste Bild-URL, überschreibt
//   recipe.primary_image) · blockClick · statusBadge (Overlay-Label, z.B. Ü23-
//   Löschzustände).

// Merkliste-Löschzustände (Ü23): leitet die Karten-Props aus deleted_at/
// purge_after ab. `deleted_at` ohne `purge_after` = Papierkorb (Thumbnail bleibt,
// „zurzeit nicht verfügbar"); `purge_after` gesetzt = endgültig gelöscht (Media
// weg → kein Bild, nur Titel, „gelöscht"). null = aktive Karte, keine Extra-Props.
export function deletedCardProps(recipe) {
  if (!recipe?.deleted_at) return null
  return {
    dimmed: true,
    blockClick: true,
    statusBadge: recipe.purge_after ? 'gelöscht' : 'zurzeit nicht verfügbar',
  }
}

function formatTime(recipe) {
  const t = (recipe?.prep_time || 0) + (recipe?.cook_time || 0)
  if (!t) return null
  return t >= 60 ? `${Math.floor(t / 60)} Std.` : `${t} Min.`
}

function formatRating(avg) {
  if (avg == null) return null
  return Number(avg).toFixed(1).replace('.', ',') // deutsche Kommaschreibweise
}

export default function RecipeCard({ recipe, onClick, dimmed = false, variant = 'default', image, blockClick = false, statusBadge = null }) {
  if (!recipe) return null

  const featured = variant === 'featured'
  const img = image ?? recipe.primary_image ?? null
  const category = recipe.categories?.[0]?.name || null
  const catColor = getCategoryColor(category)
  const time = formatTime(recipe)
  const author = recipe.author?.name || recipe.author?.username || null
  const isPending = recipe.review_status && recipe.review_status !== 'none'
  const hasRating = recipe.rating_count > 0
  const rating = hasRating ? formatRating(recipe.rating_avg) : null

  // größenabhängige Werte (default 4:3 · featured 16:9)
  const pad = featured ? 13 : 9
  const chipPos = featured ? 11 : 7
  const heartSize = featured ? 30 : 26
  const heartInset = featured ? 11 : 6
  const titleSize = featured ? 20 : 14
  const metaSize = featured ? 9 : 8

  const chipLabel = [category, time].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onClick}
      data-track-id="recipe-card-click"
      style={{
        position: 'relative',
        aspectRatio: featured ? '16 / 9' : '4 / 3',
        borderRadius: 'var(--radius-tile)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-tile)',
        transition: 'var(--transition)',
        cursor: onClick && !blockClick ? 'pointer' : 'default',
        opacity: dimmed ? 0.4 : 1,
        // `dimmed` ist rein visuell („nicht mehr favorisiert"). Es hat früher
        // auch die Pointer-Events abgeschaltet — damit war die Karte tot: weder
        // ließ sich das Herz erneut setzen noch das Rezept öffnen (BUG-64).
        // Blockiert wird nur noch über `blockClick`.
        pointerEvents: blockClick ? 'none' : undefined,
      }}
    >
      {/* Medienfläche: Foto oder Kategorie-Farbblock + Glyph */}
      {img ? (
        <div
          className="card-image-bg"
          style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: categoryGradient(category), color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={featured ? 40 : 32} height={featured ? 40 : 32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ opacity: 0.3 }} aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.6" />
            <path d="M21 15l-5-5L5 19" />
          </svg>
        </div>
      )}

      {/* Verlaufs-Overlay unten für Titel-Lesbarkeit */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,12,6,.95), rgba(16,12,6,.6) 38%, rgba(16,12,6,.12) 66%, transparent 80%)' }} />

      {/* oben links: Kategorie·Zeit — oder „Wird geprüft" (Review-Status hat Vorrang) */}
      {isPending ? (
        <span style={{ position: 'absolute', top: chipPos, left: chipPos, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: featured ? 8 : 7, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--on-accent)', background: 'rgba(0,0,0,.5)', borderRadius: 'var(--radius-tag)', padding: '3px 7px', zIndex: 2 }}>
          ● Wird geprüft
        </span>
      ) : chipLabel ? (
        <span style={{ position: 'absolute', top: chipPos, left: chipPos, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: featured ? 8 : 7, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--on-accent)', background: 'rgba(0,0,0,.4)', borderRadius: 'var(--radius-tag)', padding: '3px 7px', zIndex: 2 }}>
          {chipLabel}
        </span>
      ) : null}

      {/* oben rechts: Herz (bestehende FavoriteHeart, Rollen-Gate). Kein Outline —
          der dunkle Kreis liefert den Kontrast; --heart-outline ist im Light-Theme
          selbst dunkel und ergäbe nur einen Halo („innerer Kreis"). */}
      <FavoriteHeart
        recipeId={recipe.id}
        recipe={recipe}
        size={featured ? 20 : 18}
        outline={false}
        style={{ position: 'absolute', top: heartInset, right: heartInset, width: heartSize, height: heartSize, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', zIndex: 3, padding: 0 }}
      />

      {/* Status-Overlay (Ü23): mittig, z.B. „gelöscht" / „zurzeit nicht verfügbar".
          Der Titel unten bleibt sichtbar (Wiedererkennbarkeit). */}
      {statusBadge && (
        <span style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 3, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: featured ? 9 : 8, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--on-accent)', background: 'rgba(0,0,0,.6)', borderRadius: 'var(--radius-tag)', padding: '5px 10px', whiteSpace: 'nowrap' }}>
          {statusBadge}
        </span>
      )}

      {/* unten: Titel (Lora italic auf Bild) + Autor · ★ */}
      <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, zIndex: 2 }}>
        <h3
          lang="de"
          style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: titleSize, lineHeight: 1.08, color: 'var(--on-accent)', textShadow: '0 1px 3px rgba(0,0,0,.45)', hyphens: 'auto', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {recipe.title}
        </h3>
        {(author || rating) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontSize: metaSize, color: 'rgba(255,255,255,.85)' }}>
              {author ? `von ${author}` : ''}
            </span>
            {rating && (
              <span style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: metaSize, color: 'var(--gold-bright)' }}>★ {rating}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
