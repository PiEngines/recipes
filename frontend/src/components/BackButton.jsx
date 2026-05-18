import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../context/NavigationContext'

export default function BackButton({ fallback = '/' }) {
  const navigate = useNavigate()
  const { previousRoute, goBack } = useNavigation()

  const label = previousRoute ? `← ${previousRoute.label}` : '← Zurück'

  return (
    <button
      onClick={() => goBack(navigate, fallback)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--accent)',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontSize: '0.9rem',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {label}
    </button>
  )
}
