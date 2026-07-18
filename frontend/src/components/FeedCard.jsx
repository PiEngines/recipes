import RecipeCard from './RecipeCard'

// FeedCard = Featured-Variante der kanonischen Foto-Kachel (Wahl 2.0 · SPEC §2.1).
// Signatur stabil gehalten; delegiert an RecipeCard(variant="featured").
function imgSrc(image) {
  return image?.thumbnail_url || image?.url || null
}

export default function FeedCard({ recipe, image, onClick, dimmed = false, isPendingReview = false, blockClick = false }) {
  if (!recipe) return null
  // isPendingReview explizit → in review_status spiegeln (RecipeCard leitet den Badge daraus ab)
  const r = isPendingReview ? { ...recipe, review_status: recipe.review_status ?? 'pending' } : recipe
  return (
    <RecipeCard
      recipe={r}
      variant="featured"
      image={imgSrc(image)}
      onClick={onClick}
      dimmed={dimmed}
      blockClick={blockClick}
    />
  )
}
