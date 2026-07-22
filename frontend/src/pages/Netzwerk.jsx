// Netzwerk-Liste — Follower / Folge ich.
//
// Das Design markiert diese Fläche als offen (ABWEICHUNGEN.md D6), sie ist
// deshalb schlicht im Systemstil entworfen: Segmented oben, Zeile aus Avatar +
// Name/@username, Nachladen per Button. Erreichbar über den Stat-Tap auf
// beiden Profilen; der aktive Tab steht in `?tab=`, damit der Tap direkt im
// richtigen Segment landet und der Zurück-Weg stimmt.
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getFollowers, getFollowing, getProfile } from '../api/profile'
import BackButton from '../components/BackButton'
import Segmented from '../components/Segmented'

const TABS = [
  { key: 'followers', label: 'FOLLOWER' },
  { key: 'following', label: 'FOLGE ICH' },
]

const SEITENGROESSE = 20

const LEER_TEXT = {
  followers: 'Noch keine Follower.',
  following: 'Folgt noch niemandem.',
}

function Zeile({ person }) {
  const initialen = person.name?.[0]?.toUpperCase() ?? '?'
  return (
    <Link
      to={`/users/${person.id}`}
      data-track-id="netzwerk-user-open"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        borderRadius: 'var(--radius-card)', textDecoration: 'none',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
      }}
    >
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt=""
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent)', color: 'var(--on-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
        }}>
          {initialen}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
          color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {person.name}
        </p>
        {person.username && (
          <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            @{person.username}
          </p>
        )}
      </div>

      <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 15, color: 'var(--text-muted)' }} />
    </Link>
  )
}

export default function Netzwerk() {
  const { id } = useParams()
  const [suchParams, setSuchParams] = useSearchParams()

  const tabAusUrl = suchParams.get('tab')
  const tab = TABS.some(t => t.key === tabAusUrl) ? tabAusUrl : 'followers'

  const [profil, setProfil] = useState(null)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [seite, setSeite] = useState(1)
  // `geladen` trägt den Schlüssel des fertig geladenen Zustands — daraus leitet
  // sich `loading` ab, statt es im Effekt zu setzen.
  const [geladen, setGeladen] = useState(null)
  const [fehler, setFehler] = useState('')
  const [nachladen, setNachladen] = useState(false)

  const schluessel = `${id}:${tab}`
  const loading = geladen !== schluessel

  const holen = useCallback((seitenNr, signal) => {
    const abruf = tab === 'followers' ? getFollowers : getFollowing
    return abruf(id, { page: seitenNr, pageSize: SEITENGROESSE, ...(signal ? { signal } : {}) })
  }, [id, tab])

  useEffect(() => {
    const controller = new AbortController()
    holen(1, controller.signal)
      .then(daten => {
        setItems(daten.items || [])
        setTotal(daten.total ?? 0)
        setSeite(1)
        setFehler('')
        setGeladen(`${id}:${tab}`)
      })
      .catch(err => {
        if (err.name === 'CanceledError') return
        setFehler('Die Liste konnte nicht geladen werden.')
        setGeladen(`${id}:${tab}`)
      })
    return () => controller.abort()
  }, [holen, id, tab])

  useEffect(() => {
    const controller = new AbortController()
    getProfile(id, { signal: controller.signal })
      .then(setProfil)
      .catch(() => { /* Überschrift fällt auf den neutralen Titel zurück */ })
    return () => controller.abort()
  }, [id])

  const mehrLaden = useCallback(() => {
    setNachladen(true)
    holen(seite + 1)
      .then(daten => {
        setItems(prev => [...prev, ...(daten.items || [])])
        setTotal(daten.total ?? 0)
        setSeite(s => s + 1)
      })
      .catch(() => setFehler('Es konnten nicht mehr Einträge geladen werden.'))
      .finally(() => setNachladen(false))
  }, [holen, seite])

  const erneutVersuchen = useCallback(() => {
    setGeladen(null)
    setFehler('')
    holen(1)
      .then(daten => {
        setItems(daten.items || [])
        setTotal(daten.total ?? 0)
        setSeite(1)
      })
      .catch(() => setFehler('Die Liste konnte nicht geladen werden.'))
      .finally(() => setGeladen(`${id}:${tab}`))
  }, [holen, id, tab])

  useEffect(() => {
    document.title = 'Netzwerk – PiEngines Recipes'
  }, [])

  const wechsle = (naechster) => setSuchParams({ tab: naechster }, { replace: true })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ background: 'var(--ink-braun)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 1rem' }}>
          <p style={{
            margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)',
          }}>
            Netzwerk
          </p>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
            fontSize: 'clamp(20px, 4vw, 27px)', lineHeight: 1.05, color: 'var(--on-dark)',
          }}>
            {profil?.name || 'Profil'}
          </h1>

          <div style={{ marginTop: 14 }}>
            <Segmented
              items={TABS}
              value={tab}
              onChange={wechsle}
              ariaLabel="Follower oder Folge ich"
              trackId="netzwerk-tab-switch"
              dark
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 6rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 62, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : fehler && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
            <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--danger)' }}>
              {fehler}
            </p>
            <button
              onClick={erneutVersuchen}
              data-track-id="netzwerk-retry"
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-input)',
                border: '1.5px solid var(--border-input)', background: 'transparent',
                fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              Erneut versuchen
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
            <i className="ti ti-users" aria-hidden="true" style={{ fontSize: 38, color: 'var(--text-muted)' }} />
            <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
              {LEER_TEXT[tab]}
            </p>
          </div>
        ) : (
          <section id="netzwerk-liste" aria-label={tab === 'followers' ? 'Follower' : 'Folge ich'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(person => <Zeile key={person.id} person={person} />)}
            </div>

            {fehler && (
              <p role="status" style={{ margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--danger)' }}>
                {fehler}
              </p>
            )}

            {items.length < total && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={mehrLaden}
                  disabled={nachladen}
                  data-track-id="netzwerk-mehr-laden"
                  style={{
                    padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-input)',
                    border: '1.5px solid var(--border-input)', background: 'transparent',
                    fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)',
                    cursor: nachladen ? 'default' : 'pointer', opacity: nachladen ? 0.6 : 1,
                  }}
                >
                  {nachladen ? 'Lädt …' : 'Mehr laden'}
                </button>
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {items.length} von {total}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
