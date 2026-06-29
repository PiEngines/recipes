import { useNavigate } from 'react-router-dom'

export default function BackButton({ fallback = '/' }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: 'var(--card)',
        border: '1px solid rgba(0,0,0,.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <i className="ti ti-arrow-left" style={{ fontSize: 17, color: 'var(--text)' }} />
    </button>
  )
}
