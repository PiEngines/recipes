import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Profile data state
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true)
  const [darkModePreference, setDarkModePreference] = useState(user?.dark_mode_preference || 'system')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' })

  // My recipes
  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(true)

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [recipeAction, setRecipeAction] = useState('keep')
  const [transferUserId, setTransferUserId] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    setRecipesLoading(true)
    client.get('/api/recipes', { params: { author_id: user.id, page_size: 50, page: 1 } })
      .then(res => setRecipes(res.data.items))
      .catch(console.error)
      .finally(() => setRecipesLoading(false))
  }, [user])

  const handleProfileSave = async e => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await client.patch('/api/users/me', { name, email })
      setProfileMsg({ type: 'success', text: 'Profil gespeichert.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Speichern.' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async e => {
    e.preventDefault()
    setPasswordMsg({ type: '', text: '' })
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwörter stimmen nicht überein' })
      return
    }
    setPasswordSaving(true)
    try {
      await client.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword })
      setPasswordMsg({ type: 'success', text: 'Passwort geändert.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Ändern.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSettingsSave = async () => {
    setSettingsSaving(true)
    setSettingsMsg({ type: '', text: '' })
    try {
      await client.patch('/api/users/me', { email_notifications: emailNotifications, dark_mode_preference: darkModePreference })
      setSettingsMsg({ type: 'success', text: 'Einstellungen gespeichert.' })
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.response?.data?.detail || 'Fehler.' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    const body = { recipe_action: recipeAction }
    if (recipeAction === 'transfer' && transferUserId) {
      body.transfer_to_user_id = parseInt(transferUserId, 10)
    }
    try {
      await client.delete('/api/users/me', { data: body })
      logout()
      navigate('/login')
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler beim Löschen des Kontos.')
      setDeleting(false)
    }
  }

  const handleDeleteRecipe = async recipeId => {
    if (!window.confirm('Rezept wirklich löschen?')) return
    try {
      await client.delete(`/api/recipes/${recipeId}`)
      setRecipes(r => r.filter(x => x.id !== recipeId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler beim Löschen.')
    }
  }

  if (!user) return null

  const initials = user.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ color: 'var(--accent)', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            ← Zurück
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 600, margin: '0 0 0.25rem', color: 'var(--text)' }}>Mein Profil</h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                {user.role} · Mitglied seit {new Date(user.created_at || Date.now()).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Meine Daten */}
        <SectionCard title="Meine Daten">
          <form onSubmit={handleProfileSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="p-name">Name</label>
                <input id="p-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle} htmlFor="p-email">E-Mail</label>
                <input id="p-email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Rolle</label>
                <div style={{ ...inputStyle, background: 'transparent', cursor: 'default', color: 'var(--subtext)' }}>{user.role}</div>
              </div>
            </div>
            {profileMsg.text && <Msg type={profileMsg.type}>{profileMsg.text}</Msg>}
            <PrimaryBtn type="submit" loading={profileSaving}>Speichern</PrimaryBtn>
          </form>
        </SectionCard>

        {/* Section: Passwort ändern */}
        <SectionCard title="Passwort ändern">
          <form onSubmit={handlePasswordSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="pw-current">Aktuelles Passwort</label>
                <input id="pw-current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} required autoComplete="current-password" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="pw-new">Neues Passwort</label>
                <input id="pw-new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required autoComplete="new-password" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="pw-confirm">Bestätigen</label>
                <input id="pw-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required autoComplete="new-password" />
              </div>
            </div>
            {passwordMsg.text && <Msg type={passwordMsg.type}>{passwordMsg.text}</Msg>}
            <PrimaryBtn type="submit" loading={passwordSaving}>Passwort ändern</PrimaryBtn>
          </form>
        </SectionCard>

        {/* Section: Einstellungen */}
        <SectionCard title="Einstellungen">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>E-Mail-Benachrichtigungen</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Erhalte Updates zu deinen Rezepten und Reviews</div>
              </div>
              <ToggleSwitch checked={emailNotifications} onChange={setEmailNotifications} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="dark-mode">Erscheinungsbild</label>
              <select id="dark-mode" value={darkModePreference} onChange={e => setDarkModePreference(e.target.value)} style={{ ...inputStyle, maxWidth: '240px' }}>
                <option value="system">System</option>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
              </select>
            </div>
          </div>
          {settingsMsg.text && <Msg type={settingsMsg.type}>{settingsMsg.text}</Msg>}
          <PrimaryBtn loading={settingsSaving} onClick={handleSettingsSave}>Einstellungen speichern</PrimaryBtn>
        </SectionCard>

        {/* Section: Meine Rezepte */}
        <SectionCard title="Meine Rezepte">
          {recipesLoading ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Wird geladen …</p>
          ) : recipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Du hast noch keine Rezepte erstellt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recipes.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-input)', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/recipes/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500 }}>
                      {r.title}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                      {r.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
                      {r.review_status === 'pending' && <span style={{ marginLeft: '0.5rem', color: '#A68000' }}>· In Prüfung</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/recipes/${r.id}/edit`} style={{ padding: '0.3rem 0.75rem', background: 'rgba(200,96,42,0.08)', border: '1px solid rgba(200,96,42,0.3)', borderRadius: '6px', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                      Bearbeiten
                    </Link>
                    <button onClick={() => handleDeleteRecipe(r.id)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(200,68,68,0.08)', border: '1px solid rgba(200,68,68,0.3)', borderRadius: '6px', color: '#C84444', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Section: Konto löschen */}
        <SectionCard title="Konto löschen">
          <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht. Du hast 30 Tage Zeit, den Vorgang rückgängig zu machen.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid #C84444', borderRadius: 'var(--radius-input)', color: '#C84444', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Konto löschen
          </button>
        </SectionCard>
      </div>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, color: '#C84444', margin: '0 0 1rem' }}>
              Konto wirklich löschen?
            </h2>
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
              Diese Aktion kann innerhalb von 30 Tagen rückgängig gemacht werden. Was soll mit deinen Rezepten passieren?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
              {[
                { value: 'keep', label: 'Rezepte behalten (an System übertragen)' },
                { value: 'delete', label: 'Rezepte löschen' },
                { value: 'transfer', label: 'Rezepte an anderen Benutzer übertragen' },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text)' }}>
                  <input type="radio" name="recipe_action" value={opt.value} checked={recipeAction === opt.value} onChange={() => setRecipeAction(opt.value)} style={{ accentColor: 'var(--accent)' }} />
                  {opt.label}
                </label>
              ))}
            </div>

            {recipeAction === 'transfer' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle} htmlFor="transfer-id">Benutzer-ID des Empfängers</label>
                <input
                  id="transfer-id"
                  type="number"
                  value={transferUserId}
                  onChange={e => setTransferUserId(e.target.value)}
                  placeholder="z.B. 42"
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Wird gelöscht …' : 'Konto löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 1.25rem', color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

function Msg({ type, children }) {
  const colors = { success: { bg: 'rgba(107,124,78,0.12)', color: '#4A7040' }, error: { bg: 'rgba(200,68,68,0.1)', color: '#C84444' } }
  const c = colors[type] || colors.error
  return (
    <p style={{ margin: '0 0 1rem', padding: '0.625rem 0.875rem', background: c.bg, color: c.color, borderRadius: 'var(--radius-input)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500 }}>
      {children}
    </p>
  )
}

function PrimaryBtn({ type, loading, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type={type || 'button'}
      disabled={loading}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '0.65rem 1.5rem', background: loading ? '#D49070' : hov ? 'var(--accent-hover)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'background 0.15s' }}
    >
      {loading ? 'Wird gespeichert …' : children}
    </button>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{ width: '46px', height: '26px', borderRadius: '13px', background: checked ? 'var(--accent)' : 'var(--border-input)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.775rem',
  fontWeight: 600,
  color: 'var(--subtext)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.375rem',
  fontFamily: 'Inter, sans-serif',
}

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.875rem',
  border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}
