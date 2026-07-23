// 13 · Profil (eigen) — SPEC §13, screens/profil-eigen.html
//
// BEWUSSTE ABWEICHUNGEN (Lead-entschieden, F3b-2a — siehe ABWEICHUNGEN.md):
// - Keine Social-Chips („verbundene Konten"): ohne OAuth gibt es kein
//   Verbinden. OAuth ist als Produktentscheidung weggeschoben.
// - Dritter Tab „Einstellungen": §13 kennt nur „Meine Rezepte" und
//   „Gespeichert". Diese Seite trug aber schon die komplette Kontoverwaltung
//   (Daten, Passwort, Erscheinungsbild, freigegebene Rezepte, Konto löschen).
//   Die bleibt erhalten und zieht in einen eigenen Tab, statt ersatzlos zu
//   verschwinden oder unter den Tabs zu hängen.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { getCollections } from '../api/collections'
import { getFavorites, getProfile, getRecipesByAuthor } from '../api/profile'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import CollectionFormModal from '../components/CollectionFormModal'
import ProfileHeader from '../components/ProfileHeader'
import RecipeCard from '../components/RecipeCard'
import Segmented from '../components/Segmented'
import { getRoleLabel, isKochOrAbove } from '../utils/roles'

// Der `key` bleibt `gespeichert` — er steckt in der Tab-Logik und im
// Lade-Effekt. Nur die Beschriftung wechselt: hinter dem Tab liegen Favoriten
// *und* Sammlungen, „Gespeichert" sagte darüber nichts (BUG-38).
const TABS = [
  { key: 'rezepte', label: 'MEINE REZEPTE' },
  { key: 'gespeichert', label: 'MERKLISTE' },
  { key: 'einstellungen', label: 'EINSTELLUNGEN' },
]

const REZEPT_SEGMENTE = [
  { key: 'published', label: 'VERÖFFENTLICHT' },
  { key: 'draft', label: 'ENTWÜRFE' },
]

// Icon-Buttons statt beschrifteter Aktionen: in der Rasterzelle ist eine
// Kachel knapp halb so breit wie der Screen — „Bearbeiten"/„Löschen"
// nebeneinander passten dort nicht und rutschten untereinander. Icon-only
// braucht `aria-label` (Screenreader) und `title` (Tooltip auf Desktop).
const AKTION_BUTTON = {
  width: 34, height: 34, flexShrink: 0, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, fontSize: '1rem', lineHeight: 1, cursor: 'pointer',
  textDecoration: 'none', transition: 'background .15s',
}

function RezeptAktionen({ recipeId, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <Link
        to={`/recipes/${recipeId}/edit`}
        aria-label="Rezept bearbeiten"
        title="Bearbeiten"
        data-track-id="profile-recipe-edit"
        style={{
          ...AKTION_BUTTON,
          background: 'none',
          border: '1px solid var(--border-input)',
          color: 'var(--subtext)',
        }}
      >
        <i className="ti ti-pencil" aria-hidden="true" />
      </Link>
      <button
        onClick={() => onDelete(recipeId)}
        aria-label="Rezept löschen"
        title="Löschen"
        data-track-id="profile-recipe-delete"
        style={{
          ...AKTION_BUTTON,
          background: 'var(--danger-tint)',
          border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
          color: 'var(--danger)',
        }}
      >
        <i className="ti ti-trash" aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setTheme: applyTheme } = useTheme()

  // Profile data state
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [bio, setBio] = useState('')
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
  const [recipesError, setRecipesError] = useState(false)
  const [recipeTotal, setRecipeTotal] = useState(null)

  // Profil-Kopf + Tabs (F3b-2a)
  // `?tab=` erlaubt das gezielte Anspringen eines Tabs — etwa die Rückkehr aus
  // einer gelöschten Sammlung nach „Gespeichert". Unbekannte Werte fallen auf
  // den Standard zurück.
  const [suchParams] = useSearchParams()
  const [sammlungModal, setSammlungModal] = useState(false)
  const [tab, setTab] = useState(() => {
    const gewuenscht = suchParams.get('tab')
    return TABS.some(t => t.key === gewuenscht) ? gewuenscht : 'rezepte'
  })
  const [segment, setSegment] = useState('published')
  const [profil, setProfil] = useState(null)

  // Tab „Gespeichert"
  const [favorites, setFavorites] = useState([])
  const [collections, setCollections] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState(false)

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

  const ladeRezepte = useCallback((signal) => {
    if (!user) return Promise.resolve()
    setRecipesLoading(true)
    setRecipesError(false)
    // `total` trägt die Rezept-Zahl im Kopf — sie kommt bewusst von hier und
    // nicht aus /profile, das nur die Follow-Zahlen kennt.
    return getRecipesByAuthor(user.id, signal ? { signal } : {})
      .then(daten => {
        setRecipes(daten.items || [])
        setRecipeTotal(daten.total ?? (daten.items || []).length)
      })
      .catch(err => { if (err.name !== 'CanceledError') setRecipesError(true) })
      .finally(() => setRecipesLoading(false))
  }, [user])

  useEffect(() => {
    const controller = new AbortController()
    ladeRezepte(controller.signal)
    return () => controller.abort()
  }, [ladeRezepte])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return undefined
    const controller = new AbortController()
    getProfile(userId, { signal: controller.signal })
      .then(p => { setProfil(p); setBio(p?.bio || '') })
      .catch(() => { /* Kopf fällt auf die Auth-Daten zurück */ })
    return () => controller.abort()
  }, [userId])

  // Favoriten und Sammlungen erst laden, wenn der Tab wirklich gezeigt wird.
  const ladeGespeichert = useCallback((signal) => {
    setSavedLoading(true)
    setSavedError(false)
    const opts = signal ? { signal } : {}
    return Promise.all([getFavorites(opts), getCollections(opts)])
      .then(([favs, colls]) => { setFavorites(favs || []); setCollections(colls || []) })
      .catch(err => { if (err.name !== 'CanceledError') setSavedError(true) })
      .finally(() => setSavedLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'gespeichert') return undefined
    const controller = new AbortController()
    ladeGespeichert(controller.signal)
    return () => controller.abort()
  }, [tab, ladeGespeichert])

  const handleProfileSave = async e => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await client.patch('/api/users/me', { name, email, bio })
      // Den Kopf mitziehen, damit die Bio ohne Reload dort steht.
      setProfil(p => (p ? { ...p, bio: bio.trim() || null } : p))
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

  const veroeffentlicht = recipes.filter(r => r.status !== 'draft')
  const entwuerfe = recipes.filter(r => r.status === 'draft')
  const sichtbareRezepte = segment === 'draft' ? entwuerfe : veroeffentlicht

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <ProfileHeader
        profile={profil || { id: user.id, name: user.name, username: user.username, avatar_url: user.avatar_url }}
        recipeCount={recipeTotal}
        overline={getRoleLabel(user.role)}
      />

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.25rem 1.5rem 2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Segmented
            items={TABS}
            value={tab}
            onChange={setTab}
            ariaLabel="Profilbereiche"
            trackId="profile-tab-switch"
          />
        </div>

        {tab === 'einstellungen' && (
        <>
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
            {/* Bio: wird im Profilkopf angezeigt, auch für Fremde. Leeren
                löscht sie serverseitig (users/router.py: Leerstring → NULL). */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle} htmlFor="p-bio">Über mich</label>
              <textarea
                id="p-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ein paar Sätze über dich — erscheint auf deinem Profil."
                data-track-id="profile-bio-input"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}
              />
              <div style={{ marginTop: 4, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtext)' }}>
                {bio.length}/500
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
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>E-Mail-Benachrichtigungen</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Erhalte Updates zu deinen Rezepten und Reviews</div>
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
        </>
        )}

        {/* Tab: Gespeichert — Favoriten + eigene Sammlungen */}
        {tab === 'gespeichert' && (
          <Gespeichert
            favorites={favorites}
            collections={collections}
            loading={savedLoading}
            error={savedError}
            onRetry={() => ladeGespeichert()}
            onRecipeClick={id => navigate(`/recipes/${id}`)}
            onNeueSammlung={() => setSammlungModal(true)}
          />
        )}

        {sammlungModal && (
          <CollectionFormModal
            onClose={() => setSammlungModal(false)}
            onCreated={angelegt => {
              // Sofort in der Liste, ohne Neuladen — und direkt hinein, denn
              // eine gerade angelegte Sammlung will man befüllen.
              setCollections(vorher => [...vorher, angelegt])
              setSammlungModal(false)
              navigate(`/collections/${angelegt.id}`)
            }}
          />
        )}

        {/* Tab: Meine Rezepte */}
        {tab === 'rezepte' && (
        <>
        <div style={{ marginBottom: '1.25rem' }}>
          <Segmented
            items={[
              { ...REZEPT_SEGMENTE[0], badge: veroeffentlicht.length },
              { ...REZEPT_SEGMENTE[1], badge: entwuerfe.length },
            ]}
            value={segment}
            onChange={setSegment}
            ariaLabel="Veröffentlicht oder Entwürfe"
            trackId="profile-recipes-segment"
          />
        </div>

        <div id="meine-rezepte" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              {segment === 'draft' ? 'Entwürfe' : 'Veröffentlicht'}
            </h2>
            {!editMode && recipes.length > 0 && isKochOrAbove(user) && (
              <button onClick={enterEditMode} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Freigaben bearbeiten
              </button>
            )}
            {editMode && (
              <button onClick={() => setEditMode(false)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Fertig
              </button>
            )}
          </div>

          {recipesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-block" style={{ height: 150, borderRadius: 'var(--radius-card)' }} />
              ))}
            </div>
          ) : recipesError ? (
            <div>
              <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
                Deine Rezepte konnten nicht geladen werden.
              </p>
              <button onClick={() => ladeRezepte()} data-track-id="profile-recipes-retry" style={{ padding: '0.5rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Erneut versuchen
              </button>
            </div>
          ) : sichtbareRezepte.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
              {segment === 'draft'
                ? 'Du hast keine Entwürfe. Ein Rezept bleibt Entwurf, bis du es veröffentlichst.'
                : 'Du hast noch keine Rezepte veröffentlicht. Erstelle dein erstes Rezept.'}
            </p>
          ) : editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {sichtbareRezepte.map(r => {
                const access = accessData[r.id]
                const freeEntry = access?.items?.find(a => a.access_type === 'free_for_all')
                const individualCount = access?.items?.filter(a => a.access_type === 'individual').length ?? 0
                const isFree = !!freeEntry

                return (
                  <div key={r.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                    {/* Recipe row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link to={`/recipes/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500 }}>
                          {r.title}
                        </Link>
                        {r.review_status === 'pending' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--gold)', fontFamily: 'var(--font-body)' }}>In Prüfung</div>
                        )}
                        {isFree && (
                          <span style={{ fontSize: '0.72rem', background: 'color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', borderRadius: '5px', padding: '0.15rem 0.5rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                            🌍 Öffentlich
                          </span>
                        )}
                      </div>
                      <RezeptAktionen recipeId={r.id} onDelete={handleDeleteRecipe} />
                    </div>

                    {/* Access row — only in edit mode */}
                    {editMode && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '0.625rem 1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {access?.loading ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Wird geladen …</span>
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
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                              Einzelfreigaben
                              {individualCount > 0 && (
                                <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '999px', fontSize: '0.7rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>
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
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
              {sichtbareRezepte.map(r => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <RecipeCard recipe={r} onClick={() => navigate(`/recipes/${r.id}`)} />
                  <RezeptAktionen recipeId={r.id} onDelete={handleDeleteRecipe} />
                </div>
              ))}
            </div>
          )}
        </div>

        </>
        )}

        {/* Zweiter Einstellungen-Block: bleibt bewusst hier stehen, statt die
            beiden Sektionen über 200 Zeilen nach oben zu ziehen. Im Tab landen
            sie direkt unter den ersten dreien. */}
        {tab === 'einstellungen' && (
        <>
        {/* Section: Für mich freigegeben */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Für mich freigegeben
            </h2>
            {!unfollowMode && sharedRecipes.length > 0 && (
              <button onClick={() => setUnfollowMode(true)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Bearbeiten
              </button>
            )}
            {unfollowMode && (
              <button onClick={() => setUnfollowMode(false)} style={{ padding: '0.4rem 1rem', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-input)', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Fertig
              </button>
            )}
          </div>

          {sharedLoading && sharedRecipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>Wird geladen …</p>
          ) : sharedRecipes.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>Keine freigegebenen Rezepte.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sharedRecipes.map(r => (
                  <div key={r.access_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-input)', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/recipes/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500 }}>
                        {r.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)', marginTop: '2px' }}>
                        {r.shared_by_name && `von ${r.shared_by_name} · `}
                        {r.expires_at
                          ? `bis ${new Date(r.expires_at).toLocaleDateString('de-DE')}`
                          : 'Ohne Limit'}
                      </div>
                    </div>
                    {unfollowMode && (
                      <button
                        onClick={() => setPendingDecline({ recipeId: r.id, accessId: r.access_id, title: r.title })}
                        style={{ padding: '0.3rem 0.75rem', background: 'var(--danger-tint)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: '6px', color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
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
                  style={{ marginTop: '0.875rem', padding: '0.5rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  {sharedLoading ? 'Lädt …' : 'Mehr laden'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Section: Konto löschen */}
        <SectionCard title="Konto löschen">
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht. Du hast 30 Tage Zeit, den Vorgang rückgängig zu machen.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-input)', color: 'var(--danger)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Konto löschen
          </button>
        </SectionCard>
        </>
        )}
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
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Rezept <strong>„{pendingDecline.title}"</strong> wirklich entfernen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDecline(null)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={() => handleDecline(pendingDecline.recipeId, pendingDecline.accessId)} style={{ padding: '0.6rem 1.25rem', background: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-input)', color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)', margin: '0 0 1rem' }}>
              Konto wirklich löschen?
            </h2>
            <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
              Diese Aktion kann innerhalb von 30 Tagen rückgängig gemacht werden. Was soll mit deinen Rezepten passieren?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
              {[
                { value: 'keep', label: 'Rezepte behalten (an System übertragen)' },
                { value: 'delete', label: 'Rezepte löschen' },
                { value: 'transfer', label: 'Rezepte an anderen Benutzer übertragen' },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text)' }}>
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
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ padding: '0.6rem 1.25rem', background: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-input)', color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Wird gelöscht …' : 'Konto löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--card)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Tab „Gespeichert" — Favoriten + eigene Sammlungen ────────────────────────

const SICHTBARKEIT_LABEL = {
  private: 'Privat',
  public: 'Öffentlich',
  unlisted: 'Über Link',
}

function Gespeichert({ favorites, collections, loading, error, onRetry, onRecipeClick, onNeueSammlung }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 150, borderRadius: 'var(--radius-card)' }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
          Favoriten und Sammlungen konnten nicht geladen werden.
        </p>
        <button onClick={onRetry} data-track-id="profile-saved-retry" style={{ padding: '0.5rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <>
      <section id="profile-sammlungen" aria-label="Meine Sammlungen" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Sammlungen
          </h2>
          <button
            onClick={onNeueSammlung}
            data-track-id="profile-collection-create-open"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent)' }}
          >
            <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 15 }} />
            Neue Sammlung
          </button>
        </div>
        {collections.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 }}>
            Du hast noch keine Sammlungen angelegt.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {collections.map(c => (
              <Link
                key={c.id}
                to={`/collections/${c.id}`}
                data-track-id="profile-collection-open"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem',
                  background: 'var(--surface)', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-card)', textDecoration: 'none',
                }}
              >
                <i className="ti ti-books" aria-hidden="true" style={{ fontSize: 18, color: 'var(--text-muted)' }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>
                  {c.name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {SICHTBARKEIT_LABEL[c.visibility] || c.visibility}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {c.item_count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="profile-favoriten" aria-label="Meine Favoriten">
        <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text)' }}>
          Favoriten
        </h2>
        {favorites.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 }}>
            Noch nichts favorisiert. Tippe auf das Herz eines Rezepts.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16, alignItems: 'stretch' }}>
            {favorites.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => onRecipeClick(r.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1.25rem', color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

function Msg({ type, children }) {
  const colors = { success: { bg: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)' }, error: { bg: 'var(--danger-tint)', color: 'var(--danger)' } }
  const c = colors[type] || colors.error
  return (
    <p style={{ margin: '0 0 1rem', padding: '0.625rem 0.875rem', background: c.bg, color: c.color, borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500 }}>
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
      style={{ padding: '0.65rem 1.5rem', background: loading ? 'color-mix(in srgb, var(--accent) 60%, #ffffff)' : hov ? 'var(--accent-hover)' : 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'background 0.15s' }}
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
  fontFamily: 'var(--font-mono)',
}

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.875rem',
  border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  fontFamily: 'var(--font-body)',
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
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text)' }}>
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'var(--font-body)' }}
        >
          Deaktivieren
        </button>
      )}
      {!isActive && showExpiry && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--subtext)', cursor: 'pointer' }}>
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
            style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}
          >
            {saving ? '…' : 'Aktivieren'}
          </button>
          <button onClick={() => setShowExpiry(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.78rem', padding: 0, fontFamily: 'var(--font-body)' }}>
            Abbrechen
          </button>
        </div>
      )}
      {!isActive && !showExpiry && (
        <button
          onClick={() => { setShowExpiry(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'var(--font-body)' }}
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
          <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Einzelfreigaben – {title}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1.25rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>Keine Einzelfreigaben.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {items.map(a => (
              <AccessEntryRow key={a.id} entry={a} onRemove={() => handleRemove(a.id)} onUpdate={handleUpdateExpiry} />
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text)', cursor: 'pointer' }}>
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
            {error && <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.825rem', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={adding}
              style={{ padding: '0.6rem 1.25rem', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: adding ? 0.7 : 1 }}
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
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.email}
        </span>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button onClick={() => setEditing(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.8rem', padding: 0, fontFamily: 'var(--font-body)' }}>
            {editing ? 'Abbrechen' : entry.expires_at ? new Date(entry.expires_at).toLocaleDateString('de-DE') : 'Ohne Limit'}
          </button>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
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
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
