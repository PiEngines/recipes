import { useNavigate } from 'react-router-dom'

export default function AuthorLink({ author, style = {} }) {
  const navigate = useNavigate()
  if (!author?.username) return null

  return (
    <span
      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/recipes?author_id=${author.id}&author=${encodeURIComponent(author.username)}`) }}
      role="link"
      tabIndex={0}
      title={`Rezepte von ${author.username} anzeigen`}
      style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 500, ...style }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
    >
      {author.username}
    </span>
  )
}
