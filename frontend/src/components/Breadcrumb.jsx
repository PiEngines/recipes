import { Link } from 'react-router-dom'

export default function Breadcrumb({ items }) {
  if (!items?.length) return null
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        fontSize: '0.8rem',
        fontFamily: 'Inter, sans-serif',
        color: 'var(--subtext)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        flexWrap: 'wrap',
        marginBottom: '0.375rem',
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {i > 0 && (
            <span style={{ color: 'var(--border-input)', userSelect: 'none' }}>&rsaquo;</span>
          )}
          {item.path ? (
            <Link
              to={item.path}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--text)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
