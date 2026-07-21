// 15 · Profil (öffentlich) — SPEC §15, screens/profil-oeffentlich.html
//
// BEWUSSTE ABWEICHUNGEN (Lead-entschieden, F3b-2a — siehe ABWEICHUNGEN.md):
// - Keine Social-Chips („verbundene Konten"): ohne OAuth gibt es kein
//   Verbinden.
// - Tab „Fotos" → „Beiträge": zeigt die manuell verlinkten Instagram-/
//   TikTok-Beiträge (F3b-1), keine OAuth-Cross-Posts. Leer → Tab wird
//   ausgeblendet (§15: „FOTOS leer → ausgeblendet").
// - Die Glocke neben „Gefolgt" ist sichtbar, aber deaktiviert — das
//   Benachrichtigungs-Feature kommt erst in F3b-5. Bewusst nicht entfernt.
//
// Entwürfe tauchen hier nie auf: der Sichtbarkeitsfilter von
// /api/recipes?author_id= liefert Fremden ausschliesslich Veröffentlichtes.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  followUser, getProfile, getRecipesByAuthor, getUserExternalPosts, unfollowUser,
} from '../api/profile'
import { useAuth } from '../context/AuthContext'
import ExternalPostEmbed from '../components/ExternalPostEmbed'
import ProfileHeader from '../components/ProfileHeader'
import RecipeCard from '../components/RecipeCard'
import Segmented from '../components/Segmented'

// ── Folgen-Button + (noch stumme) Glocke ─────────────────────────────────────

function FolgenButton({ folgt, busy, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onToggle}
        disabled={busy}
        aria-pressed={folgt}
        data-track-id={folgt ? 'public-profile-unfollow' : 'public-profile-follow'}
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-pill)',
          cursor: busy ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: 'nowrap',
          border: folgt ? '1.5px solid rgba(240,232,208,.45)' : 'none',
          background: folgt ? 'transparent' : 'var(--accent)',
          color: folgt ? 'var(--on-dark)' : 'var(--on-accent)',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {folgt ? 'Gefolgt' : 'Folgen'}
      </button>

      {folgt && (
        // F3b-5 macht daraus einen echten Schalter. Bis dahin sichtbar, aber
        // ohne Funktion — und das auch für Screenreader (aria-disabled).
        <span
          role="button"
          aria-disabled="true"
          aria-label="Benachrichtigungen — bald verfügbar"
          title="Benachrichtigungen — bald verfügbar"
          data-track-id="public-profile-bell-disabled"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%',
            border: '1.5px solid rgba(240,232,208,.2)',
            color: 'rgba(240,232,208,.35)', cursor: 'not-allowed',
          }}
        >
          <i className="ti ti-bell" aria-hidden="true" style={{ fontSize: 15 }} />
        </span>
      )}
    </div>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [profil, setProfil] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [recipeTotal, setRecipeTotal] = useState(null)
  const [posts, setPosts] = useState([])
  const [tab, setTab] = useState('rezepte')
  const [folgt, setFolgt] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  // `ladeId` hält fest, für welches Profil der Ladevorgang abgeschlossen ist.
  // Daraus leitet sich `loading` ab, statt es im Effekt zu setzen — beim
  // Wechsel auf ein anderes Profil greift das automatisch.
  const [ladeId, setLadeId] = useState(null)
  const [ladeFehler, setLadeFehler] = useState('')
  const [aktionsFehler, setAktionsFehler] = useState('')
  const loading = ladeId !== id

  const laden = useCallback((signal) => {
    const opts = signal ? { signal } : {}

    // Die Beiträge dürfen fehlschlagen, ohne die Seite zu kippen — der Tab
    // verschwindet dann einfach.
    return Promise.all([
      getProfile(id, opts),
      getRecipesByAuthor(id, opts),
      getUserExternalPosts(id, opts).catch(() => []),
    ])
      .then(([p, rezepte, beitraege]) => {
        setProfil(p)
        setFolgt(!!p.is_following)
        setRecipes(rezepte.items || [])
        setRecipeTotal(rezepte.total ?? (rezepte.items || []).length)
        setPosts(beitraege || [])
        setLadeFehler('')
        setLadeId(id)
      })
      .catch(err => {
        if (err.name === 'CanceledError') return
        setLadeFehler(err?.response?.status === 404
          ? 'Dieses Profil gibt es nicht.'
          : 'Das Profil konnte nicht geladen werden.')
        setLadeId(id)
      })
  }, [id])

  const erneutVersuchen = useCallback(() => {
    setLadeId(null)      // zurück in den Ladezustand
    setLadeFehler('')
    laden()
  }, [laden])

  useEffect(() => {
    document.title = 'Profil – PiEngines Recipes'
    if (authLoading || !user) return undefined
    const controller = new AbortController()
    laden(controller.signal)
    return () => controller.abort()
  }, [laden, authLoading, user])

  // Optimistisch: der Zustand kippt sofort und rollt bei Fehler zurück.
  const toggleFolgen = useCallback(async () => {
    const vorher = folgt
    setFolgt(!vorher)
    setFollowBusy(true)
    setAktionsFehler('')
    setProfil(p => (p ? { ...p, follower_count: (p.follower_count ?? 0) + (vorher ? -1 : 1) } : p))

    try {
      if (vorher) await unfollowUser(id)
      else await followUser(id)
    } catch {
      setFolgt(vorher)
      setProfil(p => (p ? { ...p, follower_count: (p.follower_count ?? 0) + (vorher ? 1 : -1) } : p))
      setAktionsFehler('Das hat nicht geklappt. Bitte versuch es noch einmal.')
    } finally {
      setFollowBusy(false)
    }
  }, [folgt, id])

  // Der Profil-Endpoint braucht Auth. Echte Logged-out-Profile sind nicht
  // Scope 2a — hier ein sauberer Hinweis statt eines Rohfehlers.
  if (!authLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
          <i className="ti ti-user-circle" aria-hidden="true" style={{ fontSize: 42, color: 'var(--text-muted)' }} />
          <p style={{ margin: '12px 0 16px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Melde dich an, um dieses Profil zu sehen.
          </p>
          <button
            onClick={() => navigate('/login')}
            data-track-id="public-profile-login"
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-input)', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Zum Login
          </button>
        </div>
      </div>
    )
  }

  if (ladeFehler && !profil) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--danger)' }}>
            {ladeFehler}
          </p>
          <button
            onClick={erneutVersuchen}
            data-track-id="public-profile-retry"
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-input)',
              border: '1.5px solid var(--border-input)', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  const eigenesProfil = !!user && String(user.id) === String(id)
  // §15: ein leerer Beiträge-Tab wird ausgeblendet statt leer gezeigt.
  const tabs = [
    { key: 'rezepte', label: 'REZEPTE', badge: recipeTotal ?? undefined },
    ...(posts.length > 0 ? [{ key: 'beitraege', label: 'BEITRÄGE', badge: posts.length }] : []),
  ]
  const aktiverTab = tabs.some(t => t.key === tab) ? tab : 'rezepte'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <ProfileHeader
        profile={profil}
        recipeCount={recipeTotal}
        aktion={
          !eigenesProfil && profil
            ? <FolgenButton folgt={folgt} busy={followBusy} onToggle={toggleFolgen} />
            : null
        }
      />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.25rem 1.5rem 6rem' }}>
        <button
          onClick={() => navigate(-1)}
          data-track-id="public-profile-back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '0.9rem',
            padding: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          ← Zurück
        </button>

        {aktionsFehler && (
          <p role="status" style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
            {ladeFehler}
          </p>
        )}

        {tabs.length > 1 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Segmented
              items={tabs}
              value={aktiverTab}
              onChange={setTab}
              ariaLabel="Profilbereiche"
              trackId="public-profile-tab-switch"
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 150, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : aktiverTab === 'beitraege' ? (
          <section id="public-profile-beitraege" aria-label="Verlinkte Beiträge">
            {posts.map(post => (
              <div key={post.id} style={{ marginBottom: 18 }}>
                <ExternalPostEmbed post={post} />
              </div>
            ))}
          </section>
        ) : recipes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <i className="ti ti-chef-hat" aria-hidden="true" style={{ fontSize: 42, color: 'var(--text-muted)' }} />
            <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
              Noch keine veröffentlichten Rezepte.
            </p>
          </div>
        ) : (
          <section id="public-profile-rezepte" aria-label="Rezepte">
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 16, alignItems: 'stretch' }}>
              {recipes.map(r => (
                <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipes/${r.id}`)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
