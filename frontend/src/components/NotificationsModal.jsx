import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTimerContext } from '../context/TimerContext'

function fmtTimer(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function NotificationsModal() {
  const navigate = useNavigate()
  const { pendingNotifications, clearPendingNotifications } = useAuth()
  const { expiredTimers, confirmAllExpired } = useTimerContext()

  const hasNotifications = (pendingNotifications?.length ?? 0) > 0
  const hasExpired = expiredTimers.length > 0

  if (!hasNotifications && !hasExpired) return null

  const handleDismiss = () => {
    if (hasExpired) confirmAllExpired()
    if (hasNotifications) clearPendingNotifications()
  }

  const handleTimerClick = (timer) => {
    navigate(`/recipes/${timer.recipeId}`)
    handleDismiss()
  }

  const handleNotificationClick = (n) => {
    if (n.data?.recipe_id) navigate(`/recipes/${n.data.recipe_id}`)
    handleDismiss()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1.25rem' }}>
          📬 Neuigkeiten
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Expired timers */}
          {expiredTimers.map((t, i) => (
            <NotificationRow
              key={`timer_${t.id}`}
              icon="⏱"
              last={i === expiredTimers.length - 1 && !hasNotifications}
            >
              <span style={{ flex: 1 }}>
                <strong>{t.label}</strong> ist abgelaufen
              </span>
              <LinkBtn onClick={() => handleTimerClick(t)}>Zum Rezept</LinkBtn>
            </NotificationRow>
          ))}

          {/* Backend notifications */}
          {(pendingNotifications || []).map((n, i) => {
            const isLast = i === (pendingNotifications?.length ?? 0) - 1
            if (n.type === 'share_declined') {
              return (
                <NotificationRow key={i} icon="📖" last={isLast}>
                  <span style={{ flex: 1 }}>
                    <strong>{n.data.declined_by_name}</strong> folgt deinem Rezept „{n.data.recipe_title}" nicht mehr
                  </span>
                  <LinkBtn onClick={() => handleNotificationClick(n)}>Zum Rezept</LinkBtn>
                </NotificationRow>
              )
            }
            if (n.type === 'share_approved') {
              return (
                <NotificationRow key={i} icon="✅" last={isLast}>
                  <span style={{ flex: 1 }}>
                    „{n.data.recipe_title}" wurde freigegeben
                  </span>
                  <LinkBtn onClick={() => handleNotificationClick(n)}>Jetzt ansehen</LinkBtn>
                </NotificationRow>
              )
            }
            if (n.type === 'recipe_review_result') {
              const approved = n.data.approved
              return (
                <NotificationRow key={i} icon={approved ? '📝' : '❌'} last={isLast}>
                  <span style={{ flex: 1 }}>
                    {approved
                      ? <>Deine Änderungen an „{n.data.recipe_title}" wurden <strong>genehmigt</strong></>
                      : <>Deine Änderungen an „{n.data.recipe_title}" wurden <strong>abgelehnt</strong></>
                    }
                    {n.data.comment && (
                      <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--subtext)', fontSize: '0.825rem' }}>
                        {n.data.comment}
                      </span>
                    )}
                  </span>
                  <LinkBtn onClick={() => handleNotificationClick(n)}>Zum Rezept</LinkBtn>
                </NotificationRow>
              )
            }
            return null
          })}
        </div>

        <button
          onClick={handleDismiss}
          style={{ marginTop: '1.5rem', width: '100%', padding: '0.85rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer' }}
        >
          Verstanden
        </button>
      </div>
    </div>
  )
}

function NotificationRow({ icon, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      padding: '0.75rem 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  )
}

function LinkBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {children} →
    </button>
  )
}
