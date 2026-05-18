import { useNavigate } from 'react-router-dom'

export default function BackButton({ fallback = '/', label = '← Zurück' }) {
  const navigate = useNavigate()
  const handleClick = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }
  return (
    <button onClick={handleClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.9rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      {label}
    </button>
  )
}
