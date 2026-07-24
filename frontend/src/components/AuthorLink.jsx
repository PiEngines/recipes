import { useNavigate } from 'react-router-dom'

export default function AuthorLink({ author, style = {} }) {
  const navigate = useNavigate()
  if (!author?.username) return null

  const goToAuthor = e => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/recipes?author_id=${author.id}&author=${encodeURIComponent(author.username)}`)
  }

  return (
    <span
      onClick={goToAuthor}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') goToAuthor(e) }}
      role="link"
      tabIndex={0}
      title={`Rezepte von ${author.username} anzeigen`}
      style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 500, textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '2px', textDecorationColor: 'color-mix(in srgb, var(--accent) 45%, transparent)', ...style }}
      onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
    >
      {author.username}
    </span>
  )
}
