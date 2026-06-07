import { useNavigate } from 'react-router-dom'

export default function AuthorLink({ author, style = {} }) {
  const navigate = useNavigate()
  if (!author) return null

  if (!author.username) {
    return <span style={style}>{author.name}</span>
  }

  return (
    <span
      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/?author=${encodeURIComponent(author.username)}`) }}
      role="link"
      tabIndex={0}
      title={`Rezepte von ${author.name} anzeigen`}
      style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 500, ...style }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
    >
      {author.name}
    </span>
  )
}
