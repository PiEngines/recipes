// Einstellungen — Kontoverwaltung als eigene Seite unter »Mehr« (BUG-41).
//
// Zog aus dem Profil-Tab „Einstellungen" hierher: das Profil zeigt nur noch
// Identität und Inhalte, die Verwaltung liegt getrennt davon. Save-Wege und
// Formular-Bausteine sind dieselben wie zuvor (settingsUi, PATCH
// /api/users/me, POST /api/auth/change-password) — nur der Ort ist neu.
//
// „Für mich freigegebene Rezepte" wandert nicht hierher, sondern (mit BUG-41c)
// in die Merkliste — es ist Inhalt, kein Konto-Setting. Die Freigaben *eigener*
// Rezepte bleiben in der Rezept-Liste (Bearbeiten-Modus), wo sie je Rezept
// stehen.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import BackButton from '../components/BackButton'
import { SectionCard, Msg, PrimaryBtn, ToggleSwitch } from '../components/settingsUi'
import { labelStyle, inputStyle } from '../components/settingsStyles'
import { getRoleLabel } from '../utils/roles'

const idSet = list => new Set((list || []).map(x => x.id))

// Chip-Mehrfachauswahl aus einer Taxonomie — an/abwählbar, Auswahl als Set.
function ChipMulti({ label, hint, options, selected, onToggle }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      {hint && (
        <div style={{ fontSize: '0.78rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)', margin: '-0.125rem 0 0.5rem' }}>{hint}</div>
      )}
      {options.length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {options.map(o => {
            const aktiv = selected.has(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggle(o.id)}
                aria-pressed={aktiv}
                data-track-id="settings-diet-chip"
                style={{ padding: '0.4rem 0.9rem', border: `1.5px solid ${aktiv ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-pill)', background: aktiv ? 'var(--accent)' : 'none', color: aktiv ? '#fff' : 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: aktiv ? 600 : 400 }}
              >
                {o.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Einstellungen() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const { setTheme: applyTheme } = useTheme()

  // Meine Daten
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [bio, setBio] = useState(user?.bio || '')
  // „Über deine Küche" (BUG-41): Freitext + Sichtbarkeits-Toggle. Startwerte aus
  // dem Auth-User — der liefert sie seit Commit 3 auch im privaten Zustand.
  const [preferences, setPreferences] = useState(user?.preferences || '')
  const [preferencesPublic, setPreferencesPublic] = useState(user?.preferences_public ?? false)

  // Ernährungsprofil (Ü18): Auswahlwerte aus den Taxonomien, Auswahl als Sets
  // aus dem Auth-User. Speichern läuft über denselben „Über deine Küche"-Button.
  const [dietOpts, setDietOpts] = useState([])
  const [exclusionOpts, setExclusionOpts] = useState([])
  const [allergenOpts, setAllergenOpts] = useState([])
  const [dietSel, setDietSel] = useState(() => idSet(user?.diet_labels))
  const [exclusionSel, setExclusionSel] = useState(() => idSet(user?.exclusions))
  const [allergenSel, setAllergenSel] = useState(() => idSet(user?.allergens))
  const [dietPublic, setDietPublic] = useState(user?.diet_public ?? false)
  const [exclusionsPublic, setExclusionsPublic] = useState(user?.exclusions_public ?? false)

  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const controller = new AbortController()
    const opts = { signal: controller.signal }
    Promise.all([
      client.get('/api/diet-labels', opts),
      client.get('/api/exclusions', opts),
      client.get('/api/allergens', opts),
    ])
      .then(([d, e, a]) => { setDietOpts(d.data); setExclusionOpts(e.data); setAllergenOpts(a.data) })
      .catch(() => { /* Blöcke bleiben leer */ })
    return () => controller.abort()
  }, [])

  const toggleIn = (setter) => (id) => setter(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // Passwort
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  // Benachrichtigungen + Erscheinungsbild
  const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true)
  const [darkModePreference, setDarkModePreference] = useState(user?.dark_mode_preference || 'system')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' })

  // Konto löschen
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [recipeAction, setRecipeAction] = useState('keep')
  const [transferUserId, setTransferUserId] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!user) return null

  const handleProfileSave = async e => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await client.patch('/api/users/me', {
        name, email, bio,
        preferences,
        preferences_public: preferencesPublic,
        diet_label_ids: [...dietSel],
        allergen_ids: [...allergenSel],
        exclusion_ids: [...exclusionSel],
        diet_public: dietPublic,
        exclusions_public: exclusionsPublic,
      })
      // Frisch aus /auth/me: die PATCH-Antwort (UserListItem) trägt das
      // aufgelöste Ernährungsprofil nicht — der Auth-User schon.
      const me = await client.get('/api/auth/me')
      setUser(me.data)
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
    applyTheme(value) // sofortiges DOM-Update
    setDarkModePreference(value)
    try { await client.patch('/api/users/me', { dark_mode_preference: value }) } catch { /* still */ }
  }

  const handleSettingsSave = async () => {
    setSettingsSaving(true)
    setSettingsMsg({ type: '', text: '' })
    try {
      await client.patch('/api/users/me', { email_notifications: emailNotifications, dark_mode_preference: darkModePreference })
      setUser(u => (u ? { ...u, email_notifications: emailNotifications, dark_mode_preference: darkModePreference } : u))
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.25rem 1.5rem 6rem' }}>
        <BackButton fallback="/profile" floating style={{ marginBottom: '1rem' }} />

        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 5vw, 30px)', lineHeight: 1.1, color: 'var(--text)', margin: '0 0 1.5rem' }}>
          Einstellungen
        </h1>

        {/* Section: Meine Daten (+ Vorlieben) */}
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
            {/* Bio: erscheint im Profilkopf, auch für Fremde. Leeren löscht sie
                serverseitig (Leerstring → NULL). */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle} htmlFor="p-bio">Über mich</label>
              <textarea
                id="p-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ein paar Sätze über dich — erscheint auf deinem Profil."
                data-track-id="settings-bio-input"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}
              />
              <div style={{ marginTop: 4, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtext)' }}>
                {bio.length}/500
              </div>
            </div>
            {/* Vorlieben (BUG-41): Freitext, standardmäßig privat. Der Toggle
                schaltet die Anzeige auf dem Profil frei. */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle} htmlFor="p-preferences">Über deine Küche</label>
              <textarea
                id="p-preferences"
                value={preferences}
                onChange={e => setPreferences(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Erzähl uns von deiner Küche, deinem Lieblingsrezept oder deinem liebsten Dessert."
                data-track-id="settings-preferences-input"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}
              />
              <div style={{ marginTop: 4, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtext)' }}>
                {preferences.length}/2000
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>Auf Profil teilen</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Sonst sehen nur die Einstellungen sie.</div>
              </div>
              <ToggleSwitch checked={preferencesPublic} onChange={setPreferencesPublic} />
            </div>

            {/* Ernährungsprofil (Ü18) — Erfassen. Aktives Filtern folgt separat. */}
            <ChipMulti
              label="Ernährungsweise"
              options={dietOpts}
              selected={dietSel}
              onToggle={toggleIn(setDietSel)}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Ernährungsweise auf Profil teilen</div>
              <ToggleSwitch checked={dietPublic} onChange={setDietPublic} />
            </div>

            <ChipMulti
              label="Ausschlüsse"
              hint="Was du generell nicht isst."
              options={exclusionOpts}
              selected={exclusionSel}
              onToggle={toggleIn(setExclusionSel)}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--subtext)', fontFamily: 'var(--font-body)' }}>Ausschlüsse auf Profil teilen</div>
              <ToggleSwitch checked={exclusionsPublic} onChange={setExclusionsPublic} />
            </div>

            <ChipMulti
              label="Allergien"
              hint="Bleibt privat — Allergien werden nie auf dem Profil geteilt und nie als „sicher“ gekennzeichnet."
              options={allergenOpts}
              selected={allergenSel}
              onToggle={toggleIn(setAllergenSel)}
            />

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

        {/* Section: Benachrichtigungen + Erscheinungsbild */}
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

        {/* Section: Konto löschen */}
        <SectionCard title="Konto löschen">
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht. Du hast 30 Tage Zeit, den Vorgang rückgängig zu machen.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            data-track-id="settings-delete-open"
            style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-input)', color: 'var(--danger)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Konto löschen
          </button>
        </SectionCard>
      </div>

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
    </div>
  )
}
