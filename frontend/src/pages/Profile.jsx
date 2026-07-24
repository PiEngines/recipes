// 13 · Profil (eigen) — SPEC §13, screens/profil-eigen.html
//
// BEWUSSTE ABWEICHUNGEN (Lead-entschieden — siehe ABWEICHUNGEN.md):
// - Keine Social-Chips („verbundene Konten"): ohne OAuth gibt es kein
//   Verbinden. OAuth ist als Produktentscheidung weggeschoben.
// - Das Profil zeigt nur noch Identität + eigene Inhalte (F11, Revert von F7):
//   die Kontoverwaltung ist in die Seite `Einstellungen` unter »Mehr« gezogen.
//   Tabs: „Meine Rezepte" · „Merkliste" (Favoriten, Sammlungen, für mich
//   Freigegebenes) · „Beiträge" (verlinkte TT/Insta, wie das öffentliche
//   Profil).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { getCollections } from '../api/collections'
import { getFavorites, getProfile, getRecipesByAuthor, getUserExternalPosts } from '../api/profile'
import { useAuth } from '../context/AuthContext'
import AccordionSection from '../components/AccordionSection'
import CollectionFormModal from '../components/CollectionFormModal'
import ExternalPostEmbed from '../components/ExternalPostEmbed'
import PostOverlay from '../components/PostOverlay'
import ProfileHeader from '../components/ProfileHeader'
import RecipeCard, { deletedCardProps } from '../components/RecipeCard'
import SammlungAccordion from '../components/SammlungAccordion'
import Segmented from '../components/Segmented'
import { inputStyle, labelStyle } from '../components/settingsStyles'
import { getRoleLabel, isKochOrAbove } from '../utils/roles'

// Der `key` bleibt `gespeichert` — er steckt in der Tab-Logik und im
// Lade-Effekt. Nur die Beschriftung wechselt: hinter dem Tab liegen Favoriten,
// Sammlungen *und* für mich freigegebene Rezepte, „Gespeichert" sagte darüber
// nichts (BUG-38). Der Beiträge-Tab entfällt, wenn es keine gibt (wie §15).
const TABS = [
  { key: 'rezepte', label: 'MEINE REZEPTE' },
  { key: 'gespeichert', label: 'MERKLISTE' },
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
  const { user } = useAuth()
  const navigate = useNavigate()

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

  // Tab „Beiträge" — dieselbe Quelle wie das öffentliche Profil (F5). Bei
  // einem Fehler bleibt die Liste leer, der Tab verschwindet dann.
  const [posts, setPosts] = useState([])

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

  // Altlink: der Einstellungen-Tab ist eine eigene Seite geworden (F11).
  // Bestehende `?tab=einstellungen`-Links dorthin umleiten, statt sie ins
  // Leere (Standard-Tab) laufen zu lassen.
  useEffect(() => {
    if (suchParams.get('tab') === 'einstellungen') navigate('/einstellungen', { replace: true })
  }, [suchParams, navigate])

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
  // `pinsNonce` erzwingt einen Profil-Reload nach dem Speichern der Highlights.
  const [pinsNonce, setPinsNonce] = useState(0)
  const [pinsPickerOpen, setPinsPickerOpen] = useState(false)
  useEffect(() => {
    if (!userId) return undefined
    const controller = new AbortController()
    getProfile(userId, { signal: controller.signal })
      .then(p => setProfil(p))
      .catch(() => { /* Kopf fällt auf die Auth-Daten zurück */ })
    return () => controller.abort()
  }, [userId, pinsNonce])

  // Verlinkte Beiträge — einmal laden, der Tab entscheidet sich anhand der
  // Zahl (leer → kein Tab), also unabhängig davon, welcher Tab offen ist.
  useEffect(() => {
    if (!userId) return undefined
    const controller = new AbortController()
    getUserExternalPosts(userId, { signal: controller.signal })
      .then(p => setPosts(p || []))
      .catch(() => { /* Tab bleibt aus */ })
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

  // Beiträge-Tab nur, wenn es welche gibt (wie §15). Unbekanntes `?tab` fällt
  // auf „rezepte" zurück — auch der eben entfallene `einstellungen`-Wert, der
  // per Redirect ohnehin nicht mehr hier landet.
  const tabs = posts.length > 0
    ? [...TABS, { key: 'beitraege', label: 'BEITRÄGE', badge: posts.length }]
    : TABS
  const aktiverTab = tabs.some(t => t.key === tab) ? tab : 'rezepte'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <ProfileHeader
        profile={profil || { id: user.id, name: user.name, username: user.username, avatar_url: user.avatar_url }}
        recipeCount={recipeTotal}
        overline={getRoleLabel(user.role)}
        onEditPins={() => setPinsPickerOpen(true)}
      />

      {pinsPickerOpen && (
        <PinsPicker
          recipes={recipes}
          posts={posts}
          pinned={profil?.pinned}
          onClose={() => setPinsPickerOpen(false)}
          onSaved={() => { setPinsPickerOpen(false); setPinsNonce(n => n + 1) }}
        />
      )}

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.25rem 1.5rem 2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Segmented
            items={tabs}
            value={aktiverTab}
            onChange={setTab}
            ariaLabel="Profilbereiche"
            trackId="profile-tab-switch"
          />
        </div>

        {/* Tab: Gespeichert — Favoriten, Sammlungen + für mich freigegebene
            Rezepte (F11: die freigegebenen sind Inhalt, kein Konto-Setting). */}
        {aktiverTab === 'gespeichert' && (
          <>
          <Gespeichert
            favorites={favorites}
            collections={collections}
            loading={savedLoading}
            error={savedError}
            onRetry={() => ladeGespeichert()}
            onRecipeClick={id => navigate(`/recipes/${id}`)}
            onNeueSammlung={() => setSammlungModal(true)}
          />

          {/* Section: Für mich freigegeben — aus dem früheren Einstellungen-Tab
              hierher gezogen (F11). */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginTop: '2rem' }}>
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
          </>
        )}

        {/* Tab: Beiträge — verlinkte Instagram-/TikTok-Beiträge (F5), dieselbe
            Komponente wie im öffentlichen Profil. */}
        {aktiverTab === 'beitraege' && (
          <section id="profile-beitraege" aria-label="Verlinkte Beiträge">
            {posts.map(post => (
              <div key={post.id} style={{ marginBottom: 18 }}>
                <ExternalPostEmbed post={post} />
              </div>
            ))}
          </section>
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
        {aktiverTab === 'rezepte' && (
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
// `SammlungAccordion` (eine Sammlungs-Zeile) und `AccordionSection` (generischer
// Reveal-Block) liegen jetzt in components/ — geteilt mit der Favoriten-Seite.

function Gespeichert({ favorites, collections, loading, error, onRetry, onRecipeClick, onNeueSammlung }) {
  // Ein Post-Overlay für die abspielbaren Beiträge in allen Accordion-Zeilen.
  const [offenerPost, setOffenerPost] = useState(null)

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
              <SammlungAccordion
                key={c.id}
                collection={c}
                onRecipeClick={onRecipeClick}
                onPostOpen={setOffenerPost}
              />
            ))}
          </div>
        )}
      </section>

      <AccordionSection
        id="profile-favoriten"
        ariaLabel="Meine Favoriten"
        title="Favoriten"
        count={favorites.length}
        trackId="profile-favorites-toggle"
      >
        {favorites.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 }}>
            Noch nichts favorisiert. Tippe auf das Herz eines Rezepts.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16, alignItems: 'stretch' }}>
            {favorites.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => onRecipeClick(r.id)} {...(deletedCardProps(r) || {})} />
            ))}
          </div>
        )}
      </AccordionSection>

      {offenerPost && (
        <PostOverlay post={offenerPost} onClose={() => setOffenerPost(null)} />
      )}
    </>
  )
}

// ── Highlights-Picker (nur eigenes Profil) ────────────────────────────────────

const PIN_MAX = 3

// Auswahl je Typ als geordnete ID-Liste; Antippen fügt hinten an oder nimmt
// heraus, bei drei ist Schluss. Reihenfolge = Anzeigereihenfolge.
function PinsPicker({ recipes, posts, pinned, onClose, onSaved }) {
  const [recipeIds, setRecipeIds] = useState(() => (pinned?.recipes || []).map(r => r.id))
  const [postIds, setPostIds] = useState(() => (pinned?.posts || []).map(p => p.id))
  const [saving, setSaving] = useState(false)
  const [fehler, setFehler] = useState('')

  const umschalten = (setter, id) => setter(prev => {
    if (prev.includes(id)) return prev.filter(x => x !== id)
    if (prev.length >= PIN_MAX) return prev
    return [...prev, id]
  })

  const speichern = async () => {
    setSaving(true)
    setFehler('')
    try {
      await client.put('/api/users/me/pins', { recipe_ids: recipeIds, external_post_ids: postIds })
      onSaved()
    } catch (err) {
      setFehler(err.response?.data?.detail || 'Speichern fehlgeschlagen.')
      setSaving(false)
    }
  }

  const auswahlNr = (list, id) => list.indexOf(id) + 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.5rem', maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>
          Highlights wählen
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--subtext)' }}>
          Bis zu {PIN_MAX} Rezepte und {PIN_MAX} Beiträge fürs Profil.
        </p>

        <PickerGruppe
          titel={`Rezepte (${recipeIds.length}/${PIN_MAX})`}
          eintraege={recipes.map(r => ({ id: r.id, label: r.title }))}
          nr={id => auswahlNr(recipeIds, id)}
          onToggle={id => umschalten(setRecipeIds, id)}
          leer="Du hast noch keine Rezepte."
        />
        <PickerGruppe
          titel={`Beiträge (${postIds.length}/${PIN_MAX})`}
          eintraege={posts.map(p => ({ id: p.id, label: p.author_name ? `${p.platform} · ${p.author_name}` : p.url }))}
          nr={id => auswahlNr(postIds, id)}
          onToggle={id => umschalten(setPostIds, id)}
          leer="Du hast noch keine Beiträge verlinkt."
        />

        {fehler && <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>{fehler}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'var(--font-body)', cursor: 'pointer', fontSize: '0.875rem' }}>
            Abbrechen
          </button>
          <button onClick={speichern} disabled={saving} style={{ padding: '0.6rem 1.25rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-input)', color: 'var(--on-accent)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PickerGruppe({ titel, eintraege, nr, onToggle, leer }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>{titel}</div>
      {eintraege.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{leer}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {eintraege.map(e => {
            const rang = nr(e.id)
            const aktiv = rang > 0
            return (
              <button
                key={e.id}
                onClick={() => onToggle(e.id)}
                aria-pressed={aktiv}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.6rem 0.75rem', border: `1.5px solid ${aktiv ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 'var(--radius-input)', background: aktiv ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, background: aktiv ? 'var(--accent)' : 'var(--border-input)', color: aktiv ? 'var(--on-accent)' : 'var(--subtext)' }}>
                  {aktiv ? rang : ''}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
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
