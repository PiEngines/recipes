import FavoriteHeart from './FavoriteHeart'

const CARD_GRADIENTS = [
  'linear-gradient(148deg, #A85A28 0%, #6B3510 100%)',
  'linear-gradient(148deg, #5C3A1E 0%, #8B6540 100%)',
  'linear-gradient(148deg, #B09A3E 0%, #7A6A1A 100%)',
  'linear-gradient(148deg, #3D4F25 0%, #6B7C4E 100%)',
  'linear-gradient(148deg, #6B5A3E 0%, #3E3020 100%)',
  'linear-gradient(148deg, #8A3E18 0%, #C47040 100%)',
  'linear-gradient(148deg, #2E4A1E 0%, #4A7032 100%)',
  'linear-gradient(148deg, #7A4A2A 0%, #B07050 100%)',
]

function cardGradient(r) {
  return CARD_GRADIENTS[(r?.id ?? 0) % CARD_GRADIENTS.length]
}

function fmtTime(r) {
  const t = (r?.prep_time || 0) + (r?.cook_time || 0)
  if (!t) return null
  return t >= 60 ? `${Math.floor(t / 60)} Std.` : `${t} Min.`
}

function imgSrc(img) {
  return img?.thumbnail_url || img?.url || null
}

export default function FeedCard({ recipe, image, onClick, dimmed = false, isPendingReview = false, blockClick = false }) {
  const src = imgSrc(image)
  const t = fmtTime(recipe)
  return (
    <div
      onClick={onClick}
      data-track-id="feed-card-click"
      style={{
        background: 'var(--card)',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,.07)',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        opacity: dimmed ? 0.4 : 1,
        pointerEvents: dimmed || blockClick ? 'none' : 'auto',
      }}
    >
      <div style={{ height: 118, position: 'relative', overflow: 'hidden', background: src ? undefined : cardGradient(recipe) }}>
        {src && <div className="card-image-bg" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        {isPendingReview && (
          <span style={{ position: 'absolute', top: 8, left: 8, padding: '0.2rem 0.55rem', background: 'rgba(200,160,32,0.9)', color: '#5a4400', borderRadius: 'var(--radius-pill)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.02em', zIndex: 2 }}>
            Wird geprüft
          </span>
        )}
        <FavoriteHeart recipeId={recipe.id} recipe={recipe} size={20} outline={false}
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.9)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, padding: 0 }} />
      </div>
      <div style={{ padding: '9px 11px 11px', background: 'rgba(255,255,255,0.88)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', margin: '0 0 5px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{recipe.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {recipe.author?.username && <span style={{ fontSize: 11, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>{recipe.author.username}</span>}
          {recipe.author?.username && t && <span style={{ fontSize: 11, color: 'var(--border-input)' }}>·</span>}
          {t && <span style={{ fontSize: 11, color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>{t}</span>}
        </div>
      </div>
    </div>
  )
}
