import FavoriteHeart from './FavoriteHeart'

// Deterministischer Gradient-Fallback (on-brand: Terracotta ↔ Olive)
const CARD_GRADIENTS = [
  'linear-gradient(148deg, #A85A28 0%, #6B3510 100%)',
  'linear-gradient(148deg, #5C3A1E 0%, #8B6540 100%)',
  'linear-gradient(148deg, #B09A3E 0%, #7A6A1A 100%)',
  'linear-gradient(148deg, #3D4F25 0%, #6B7C4E 100%)',
  'linear-gradient(148deg, #6B5A3E 0%, #3E3020 100%)',
  'linear-gradient(148deg, #8A3E18 0%, #C47040 100%)',
]

function gradientFor(id) {
  return CARD_GRADIENTS[(id ?? 0) % CARD_GRADIENTS.length]
}

function formatTime(recipe) {
  const t = (recipe?.prep_time || 0) + (recipe?.cook_time || 0)
  if (!t) return null
  return t >= 60 ? `${Math.floor(t / 60)} Std.` : `${t} Min.`
}

export default function RecipeCard({ recipe, onClick }) {
  if (!recipe) return null
  const img = recipe.primary_image || null
  const time = formatTime(recipe)
  const author = recipe.author?.name || recipe.author?.username || null
  const isPending = recipe.review_status && recipe.review_status !== 'none'
  const hasRating = recipe.rating_count > 0

  return (
    <div
      onClick={onClick}
      data-track-id="recipe-card-click"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow)',
        transition: 'var(--transition)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: img ? undefined : gradientFor(recipe.id) }}>
        {img && (
          <div
            className="card-image-bg"
            style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        {isPending && (
          <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', borderRadius: 'var(--radius-pill)', padding: '5px 10px', zIndex: 2 }}>
            ● Wird geprüft
          </span>
        )}
        <FavoriteHeart
          recipeId={recipe.id}
          recipe={recipe}
          size={18}
          outline={false}
          style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow)', cursor: 'pointer', zIndex: 3, padding: 0 }}
        />
      </div>
      <div style={{ padding: '11px 12px 13px' }}>
        <h3
          lang="de"
          style={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: 17, lineHeight: 1.25, margin: 0, minHeight: '2.5em', hyphens: 'auto', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {recipe.title}
        </h3>
        {(author || time || hasRating) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
            {author && <span>{author}</span>}
            {author && time && <span aria-hidden="true">·</span>}
            {time && <span>{time}</span>}
            {hasRating && (author || time) && <span aria-hidden="true">·</span>}
            {hasRating && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>★ {recipe.rating_avg} ({recipe.rating_count})</span>}
          </div>
        )}
      </div>
    </div>
  )
}
