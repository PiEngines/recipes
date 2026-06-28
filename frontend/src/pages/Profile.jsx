import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import Breadcrumb from '../components/Breadcrumb'
import BackButton from '../components/BackButton'
import { getRoleLabel, isKochOrAbove } from '../utils/roles'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setTheme: applyTheme } = useTheme()

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

  // Sharing matrix
  const [editMode, setEditMode] = useState(false)
  const [accessData, setAccessData] = useState({}) // { recipeId: { items, loading } }
  const [accessModal, setAccessModal] = useState(null) // { recipeId, title }

  // Shared recipes section
  const [sharedRecipes, setSharedRecipes] = useState([])
  const [sharedTotal, setSharedTotal] = useState(0)
  const [sharedPage, setSharedPage] = useState(1)
  const [sharedLoading, setSharedLoading] = useState(false)
  const [unfollowMode, setUnfollowMode] = useState(false)
  const [pendingDecline, setPendingDecline] = useState(null) // { recipeId, accessId, title }

  // Toast
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)

  const showToast = msg => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 4000)
  }

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

  const handleThemeChange = async (value) => {
    applyTheme(value) // immediate DOM update
    setDarkModePreference(value)
    try { await client.patch('/api/users/me', { dark_mode_preference: value }) } catch {}
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

  const loadAccess = async recipeId => {
    setAccessData(prev => ({ ...prev, [recipeId]: { ...(prev[recipeId] || {}), loading: true } }))
    try {
      const { data } = await client.get(`/api/recipes/${recipeId}/access`, { params: { page: 1, page_size: 50 } })
      setAccessData(prev => ({ ...prev, [recipeId]: { items: data.items || [], loading: false } }))
    } catch {
      setAccessData(prev => ({ ...prev, [recipeId]: { items: [], loading: false } }))
    }
  }

  const enterEditMode = async () => {
    setEditMode(true)
    await Promise.all(recipes.map(r => loadAccess(r.id)))
  }

  const loadSharedRecipes = async (page = 1) => {
    setSharedLoading(true)
    try {
      const { data } = await client.get('/api/users/me/shared-recipes', { params: { page, page_size: 20 } })
      if (page === 1) setSharedRecipes(data.items)
      else setSharedRecipes(prev => [...prev, ...data.items])
      setSharedTotal(data.total)
      setSharedPage(page)
    } catch {}
    finally { setSharedLoading(false) }
  }

  useEffect(() => { if (user) loadSharedRecipes(1) }, [user?.id])

  const handleToggleFreeForAll = async (recipeId, enable, expiresDays) => {
    const current = accessData[recipeId]?.items || []
    const existing = current.find(a => a.access_type === 'free_for_all')
    try {
      if (enable) {
        await client.post(`/api/recipes/${recipeId}/access`, {
          access_type: 'free_for_all',
          expires_days: expiresDays || null,
        })
        showToast('Rezept ist jetzt öffentlich zugänglich.')
      } else if (existing) {
        await client.delete(`/api/recipes/${recipeId}/access/${existing.id}`)
        showToast('Rezept ist nicht mehr öffentlich.')
      }
      await loadAccess(recipeId)
    } catch {}
  }

  const handleDecline = async (recipeId, accessId) => {
    try {
      await client.post(`/api/recipes/${recipeId}/access/${accessId}/decline`)
      setSharedRecipes(prev => prev.filter(r => r.access_id !== accessId))
      setSharedTotal(t => t - 1)
      showToast('Rezept entfernt.')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Entfernen.')
    }
    setPendingDecline(null)
  }

  if (!user) return null

  const initials = user.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="md:hidden" style={{ marginBottom: '0.75rem' }}>
            <BackButton />
          </div>
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Startseite', path: '/' }, { label: 'Profil' }]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 600, margin: '0 0 0.25rem', color: 'var(--text)' }}>Mein Profil</h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                {getRoleLabel(user.role)} · Mitglied seit {new Date(user.created_at || Date.now()).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
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
                <div style={{ ...inputStyle, background: 'transparent', cursor: 'default', color: 'var(--subtext)' }}>{getRoleLabel(user.role)}</div>
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
              <select id="dark-mode" value={darkModePreference} onChange={e => handleThemeChange(e.target.value)} style={{ ...inputStyle, maxWidth: '240px' }}>
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
        <div id="meine-rezepte" style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
              Meine Rezepte
            </h2>
            {!editMode && recipes.length > 0 && isKochOrAbove(user) && (
              <button onClick={enterEditMode} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Freigaben bearbeiten
              </button>
            )}
            {editMode && (
              <button onClick={() => setEditMode(false)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Fertig
              </button>
            )}
          </div>

          {recipesLoading ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Wird geladen …</p>
          ) : recipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Du hast noch keine Rezepte erstellt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: editMode ? '0.875rem' : '0.5rem' }}>
              {recipes.map(r => {
                const access = accessData[r.id]
                const freeEntry = access?.items?.find(a => a.access_type === 'free_for_all')
                const individualCount = access?.items?.filter(a => a.access_type === 'individual').length ?? 0
                const isFree = !!freeEntry

                return (
                  <div key={r.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                    {/* Recipe row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link to={`/recipes/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500 }}>
                          {r.title}
                        </Link>
                        {r.review_status === 'pending' && (
                          <div style={{ fontSize: '0.75rem', color: '#A68000', fontFamily: 'Inter, sans-serif' }}>In Prüfung</div>
                        )}
                        {isFree && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(107,124,78,0.15)', color: '#4A7040', borderRadius: '5px', padding: '0.15rem 0.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                            🌍 Öffentlich
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <Link to={`/recipes/${r.id}/edit`} style={{ padding: '0.3rem 0.75rem', background: 'rgba(200,96,42,0.08)', border: '1px solid rgba(200,96,42,0.3)', borderRadius: '6px', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                          ✏️
                        </Link>
                        <button onClick={() => handleDeleteRecipe(r.id)} style={{ padding: '0.3rem 0.75rem', background: 'rgba(200,68,68,0.08)', border: '1px solid rgba(200,68,68,0.3)', borderRadius: '6px', color: '#C84444', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                          Löschen
                        </button>
                      </div>
                    </div>

                    {/* Access row — only in edit mode */}
                    {editMode && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '0.625rem 1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {access?.loading ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Wird geladen …</span>
                        ) : (
                          <>
                            <FreeForAllToggle
                              recipeId={r.id}
                              isActive={isFree}
                              currentEntry={freeEntry}
                              onToggle={handleToggleFreeForAll}
                            />
                            <button
                              onClick={() => setAccessModal({ recipeId: r.id, title: r.title })}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 500 }}
                            >
                              Einzelfreigaben
                              {individualCount > 0 && (
                                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>
                                  {individualCount}
                                </span>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Section: Für mich freigegeben */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
              Für mich freigegeben
            </h2>
            {!unfollowMode && sharedRecipes.length > 0 && (
              <button onClick={() => setUnfollowMode(true)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Bearbeiten
              </button>
            )}
            {unfollowMode && (
              <button onClick={() => setUnfollowMode(false)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Fertig
              </button>
            )}
          </div>

          {sharedLoading && sharedRecipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Wird geladen …</p>
          ) : sharedRecipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Keine freigegebenen Rezepte.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sharedRecipes.map(r => (
                  <div key={r.access_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-input)', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/recipes/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500 }}>
                        {r.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                        {r.shared_by_name && `von ${r.shared_by_name} · `}
                        {r.expires_at
                          ? `bis ${new Date(r.expires_at).toLocaleDateString('de-DE')}`
                          : 'Ohne Limit'}
                      </div>
                    </div>
                    {unfollowMode && (
                      <button
                        onClick={() => setPendingDecline({ recipeId: r.id, accessId: r.access_id, title: r.title })}
                        style={{ padding: '0.3rem 0.75rem', background: 'rgba(200,68,68,0.08)', border: '1px solid rgba(200,68,68,0.3)', borderRadius: '6px', color: '#C84444', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        Nicht mehr folgen
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {sharedRecipes.length < sharedTotal && (
                <button
                  onClick={() => loadSharedRecipes(sharedPage + 1)}
                  disabled={sharedLoading}
                  style={{ marginTop: '0.875rem', padding: '0.5rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  {sharedLoading ? 'Lädt …' : 'Mehr laden'}
                </button>
              )}
            </>
          )}
        </div>

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

      {/* Individual access modal */}
      {accessModal && (
        <IndividualAccessModal
          recipeId={accessModal.recipeId}
          title={accessModal.title}
          items={(accessData[accessModal.recipeId]?.items || []).filter(a => a.access_type === 'individual')}
          onClose={() => setAccessModal(null)}
          onRefresh={() => loadAccess(accessModal.recipeId)}
          onToast={showToast}
        />
      )}

      {/* Decline confirmation */}
      {pendingDecline && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Rezept <strong>„{pendingDecline.title}"</strong> wirklich entfernen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDecline(null)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={() => handleDecline(pendingDecline.recipeId, pendingDecline.accessId)} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Ja, entfernen
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--card)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-pill)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast}
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

// ── Free-for-all toggle per recipe ────────────────────────────────────────────

function FreeForAllToggle({ recipeId, isActive, currentEntry, onToggle }) {
  const [saving, setSaving] = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [noLimit, setNoLimit] = useState(true)

  const handleChange = async checked => {
    if (checked && !noLimit && !expiryDate) { setShowExpiry(true); return }
    setSaving(true)
    let expiresDays = null
    if (checked && !noLimit && expiryDate) {
      const diffMs = new Date(expiryDate) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    await onToggle(recipeId, checked, expiresDays)
    setSaving(false)
    setShowExpiry(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text)' }}>
        <input
          type="checkbox"
          checked={isActive}
          disabled={saving}
          onChange={e => handleChange(e.target.checked)}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        🌍 Free for all
        {isActive && currentEntry?.expires_at && (
          <span style={{ color: 'var(--subtext)', fontWeight: 400 }}>
            · bis {new Date(currentEntry.expires_at).toLocaleDateString('de-DE')}
          </span>
        )}
      </label>
      {isActive && (
        <button
          onClick={() => handleChange(false)}
          disabled={saving}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'Inter, sans-serif' }}
        >
          Deaktivieren
        </button>
      )}
      {!isActive && showExpiry && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--subtext)', cursor: 'pointer' }}>
            <input type="checkbox" checked={noLimit} onChange={e => setNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Ohne Limit
          </label>
          {!noLimit && (
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inputStyle, width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
            />
          )}
          <button
            onClick={() => handleChange(true)}
            disabled={saving || (!noLimit && !expiryDate)}
            style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
          >
            {saving ? '…' : 'Aktivieren'}
          </button>
          <button onClick={() => setShowExpiry(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.78rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
            Abbrechen
          </button>
        </div>
      )}
      {!isActive && !showExpiry && (
        <button
          onClick={() => { setShowExpiry(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'Inter, sans-serif' }}
        >
          Aktivieren …
        </button>
      )}
    </div>
  )
}

// ── Individual access modal ───────────────────────────────────────────────────

function IndividualAccessModal({ recipeId, title, items, onClose, onRefresh, onToast }) {
  const [newEmail, setNewEmail] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [newNoLimit, setNewNoLimit] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async e => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setAdding(true)
    setError('')
    let expiresDays = null
    if (!newNoLimit && newExpiry) {
      const diffMs = new Date(newExpiry) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    try {
      await client.post(`/api/recipes/${recipeId}/access`, {
        access_type: 'individual',
        email: newEmail.trim(),
        expires_days: expiresDays,
      })
      const limitLabel = newNoLimit ? 'Ohne Limit' : newExpiry ? new Date(newExpiry).toLocaleDateString('de-DE') : 'Ohne Limit'
      onToast?.(`Mit ${newEmail.trim()} erfolgreich geteilt. Limit: ${limitLabel}`)
      setNewEmail('')
      setNewExpiry('')
      setNewNoLimit(true)
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Hinzufügen.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async accessId => {
    try {
      await client.delete(`/api/recipes/${recipeId}/access/${accessId}`)
      onRefresh()
    } catch {}
  }

  const handleUpdateExpiry = async (accessId, expiresDays, ohneLimit) => {
    try {
      await client.patch(`/api/recipes/${recipeId}/access/${accessId}`, {
        expires_days: ohneLimit ? null : expiresDays,
        ohne_limit: ohneLimit,
      })
      onRefresh()
    } catch {}
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.75rem', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
            Einzelfreigaben – {title}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1.25rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>Keine Einzelfreigaben.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {items.map(a => (
              <AccessEntryRow key={a.id} entry={a} onRemove={() => handleRemove(a.id)} onUpdate={handleUpdateExpiry} />
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
            Hinzufügen
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email-Adresse"
              required
              style={{ ...inputStyle }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={newNoLimit} onChange={e => setNewNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Ohne Limit
              </label>
              {!newNoLimit && (
                <input
                  type="date"
                  value={newExpiry}
                  onChange={e => setNewExpiry(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }}
                />
              )}
            </div>
            {error && <p style={{ color: '#C84444', fontFamily: 'Inter, sans-serif', fontSize: '0.825rem', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={adding}
              style={{ padding: '0.6rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: adding ? 0.7 : 1 }}
            >
              {adding ? 'Wird hinzugefügt …' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AccessEntryRow({ entry, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [expiryDate, setExpiryDate] = useState(
    entry.expires_at ? new Date(entry.expires_at).toISOString().split('T')[0] : ''
  )
  const [noLimit, setNoLimit] = useState(!entry.expires_at)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    let expiresDays = null
    if (!noLimit && expiryDate) {
      const diffMs = new Date(expiryDate) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    await onUpdate(entry.id, expiresDays, noLimit)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '0.625rem 0.75rem', background: 'var(--bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.email}
        </span>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button onClick={() => setEditing(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.8rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
            {editing ? 'Abbrechen' : entry.expires_at ? new Date(entry.expires_at).toLocaleDateString('de-DE') : 'Ohne Limit'}
          </button>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C84444', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={noLimit} onChange={e => setNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Ohne Limit
          </label>
          {!noLimit && (
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inputStyle, width: 'auto', flex: 1, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
            />
          )}
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
