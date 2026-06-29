import { useNavigate } from 'react-router-dom'
import { de } from '../i18n/de'

export default function BackButton({ onClick, fallback = '/' }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) onClick()
    else if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      onClick={handleClick}
      style={{
        background: 'rgba(200, 96, 42, 0.08)',
        border: '1px solid rgba(200, 96, 42, 0.25)',
        borderRadius: 'var(--radius-pill)',
        padding: '6px 14px 6px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--accent)',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <i className="ti ti-arrow-left" style={{ fontSize: 15 }} />
      {de.backButton}
    </button>
  )
}
