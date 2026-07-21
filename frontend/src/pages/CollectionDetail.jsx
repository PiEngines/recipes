/**
 * Sammlungs-Detailseite (F3b-2b) — `/collections/:id`.
 *
 * Für diesen Screen gibt es keinen Design-Entwurf (in SPEC.md/ABWEICHUNGEN als
 * offen markiert); er ist deshalb bewusst schlicht im Systemstil gehalten:
 * Kopf mit Name, Sichtbarkeit und Anzahl, darunter dasselbe Kachelraster wie
 * im Feed.
 *
 * Die Items sind gemischt. Rezepte laufen über `RecipeCard`, verlinkte
 * Beiträge über `PostKachel` + `PostOverlay` — dieselbe Tap-to-Play-Regel wie
 * im Entdecken-Feed: der Player entsteht erst beim Antippen, nicht schon beim
 * Scrollen.
 *
 * Reihenfolge kommt vom Server (`sort_order`); Umsortieren ist hier bewusst
 * nicht angeboten.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  deleteCollection,
  getCollection,
  patchCollection,
  removeCollectionItem,
} from '../api/collections'
import BackButton from '../components/BackButton'
import PostKachel from '../components/PostKachel'
import PostOverlay from '../components/PostOverlay'
import RecipeCard from '../components/RecipeCard'
import { Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const SICHTBARKEIT_LABEL = {
  private: 'Privat',
  public: 'Öffentlich',
  unlisted: 'Über Link',
}

// Nur diese beiden sind im Formular wählbar. `unlisted` kennt die API zwar,
// aber es gibt bisher keinen Ort, an dem ein solcher Link entstünde — als
// Option angeboten wäre es ein Versprechen ohne Einlösung.
const SICHTBARKEIT_OPTIONEN = [
  { wert: 'private', label: 'Privat', hinweis: 'Nur du siehst diese Sammlung.' },
  { wert: 'public', label: 'Öffentlich', hinweis: 'Auf deinem Profil sichtbar.' },
]

function itemKey(item) {
  return `${item.item_type}-${item.item_id}`
}

export default function CollectionDetail() {
  const { id } = useParams()
  // `key` statt Zurücksetzen im Effekt: wechselt die id, montiert React die
  // Seite neu und alle Zustände starten frisch — kein Nachziehen von Hand.
  return <SammlungsSeite key={id} id={id} />
}

function SammlungsSeite({ id }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [sammlung, setSammlung] = useState(null)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState(false)
  const [offenerPost, setOffenerPost] = useState(null)

  const [bearbeiten, setBearbeiten] = useState(false)
  const [entwurf, setEntwurf] = useState({ name: '', visibility: 'private' })
  const [speichert, setSpeichert] = useState(false)
  const [formFehler, setFormFehler] = useState('')
  const [loeschAbfrage, setLoeschAbfrage] = useState(false)

  // Setzt bewusst kein `laedt`/`fehler` vorab: beim Erstlauf stimmt der
  // Startzustand schon, und der Retry-Knopf setzt beides selbst.
  const laden = useCallback((signal) => {
    return getCollection(id, { signal })
      .then(daten => {
        setSammlung(daten)
        setEntwurf({ name: daten.name, visibility: daten.visibility })
      })
      .catch(err => { if (err.name !== 'CanceledError') setFehler(true) })
      .finally(() => setLaedt(false))
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    laden(controller.signal)
    return () => controller.abort()
  }, [laden])

  useEffect(() => {
    document.title = sammlung ? `${sammlung.name} — Sammlung` : 'Sammlung'
  }, [sammlung])

  // Der Server prüft die Rechte ohnehin; das Frontend blendet nur aus, was
  // ohnehin abgelehnt würde.
  const istOwner = Boolean(user && sammlung && sammlung.created_by === user.id)

  const speichern = async e => {
    e.preventDefault()
    const name = entwurf.name.trim()
    if (!name) {
      setFormFehler('Bitte gib der Sammlung einen Namen.')
      return
    }
    setSpeichert(true)
    setFormFehler('')
    try {
      const aktualisiert = await patchCollection(sammlung.id, {
        name,
        visibility: entwurf.visibility,
      })
      // PATCH liefert die Summary ohne Items — die vorhandenen behalten.
      setSammlung(vorher => ({ ...vorher, ...aktualisiert }))
      setBearbeiten(false)
    } catch {
      setFormFehler('Konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setSpeichert(false)
    }
  }

  const loeschen = async () => {
    setSpeichert(true)
    try {
      await deleteCollection(sammlung.id)
      navigate('/profile?tab=gespeichert', { replace: true })
    } catch {
      setFormFehler('Konnte nicht gelöscht werden. Bitte versuch es erneut.')
      setSpeichert(false)
      setLoeschAbfrage(false)
    }
  }

  const entfernen = async item => {
    const vorher = sammlung
    // Optimistisch: das Item verschwindet sofort, die Zahl im Kopf zieht mit.
    setSammlung(s => ({
      ...s,
      items: s.items.filter(i => itemKey(i) !== itemKey(item)),
      item_count: Math.max(0, s.item_count - 1),
    }))
    try {
      await removeCollectionItem(vorher.id, {
        itemType: item.item_type,
        itemId: item.item_id,
      })
    } catch {
      setSammlung(vorher)  // zurückrollen, sonst zeigt die Seite eine Lüge
    }
  }

  if (laedt) {
    return (
      <Rahmen>
        <div className="skeleton-block" style={{ height: 32, width: '60%', borderRadius: 4, marginBottom: 20 }} />
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ aspectRatio: '4 / 3', borderRadius: 'var(--radius-card)' }} />
          ))}
        </div>
      </Rahmen>
    )
  }

  if (fehler || !sammlung) {
    return (
      <Rahmen>
        <BackButton fallback="/profile" />
        <p style={{ marginTop: 24, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--subtext)' }}>
          Diese Sammlung konnte nicht geladen werden.
        </p>
        <Button variant="secondary" size="sm" trackId="collection-detail-retry"
          onClick={() => { setLaedt(true); setFehler(false); laden() }}>
          Erneut versuchen
        </Button>
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      <BackButton fallback="/profile" />

      {/* Kopf */}
      <header style={{ padding: '18px 0 22px' }}>
        {bearbeiten ? (
          <form onSubmit={speichern} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
            <Input
              label="Name"
              value={entwurf.name}
              onChange={e => setEntwurf(v => ({ ...v, name: e.target.value }))}
              maxLength={255}
              autoFocus
              trackId="collection-detail-name-input"
            />
            <Sichtbarkeitswahl
              wert={entwurf.visibility}
              onChange={wert => setEntwurf(v => ({ ...v, visibility: wert }))}
            />
            {formFehler && (
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
                {formFehler}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" size="sm" disabled={speichert} trackId="collection-detail-save">
                {speichert ? 'Wird gespeichert …' : 'Speichern'}
              </Button>
              <Button type="button" variant="ghost" size="sm" trackId="collection-detail-cancel"
                onClick={() => {
                  setBearbeiten(false)
                  setFormFehler('')
                  setEntwurf({ name: sammlung.name, visibility: sammlung.visibility })
                }}>
                Abbrechen
              </Button>
            </div>
          </form>
        ) : (
          <>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 34px)', lineHeight: 1.15, color: 'var(--text)' }}>
              {sammlung.name}
            </h1>
            <p style={{ margin: '7px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <i className={`ti ti-${sammlung.visibility === 'private' ? 'lock' : 'world'}`} aria-hidden="true" style={{ fontSize: 13 }} />
              {SICHTBARKEIT_LABEL[sammlung.visibility] || sammlung.visibility}
              <span aria-hidden="true">·</span>
              {sammlung.item_count} {sammlung.item_count === 1 ? 'Eintrag' : 'Einträge'}
            </p>

            {istOwner && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button variant="secondary" size="sm" trackId="collection-detail-edit-open"
                  onClick={() => setBearbeiten(true)}
                  leftIcon={<i className="ti ti-pencil" aria-hidden="true" />}>
                  Bearbeiten
                </Button>
                <Button variant="ghost" size="sm" trackId="collection-detail-delete-open"
                  onClick={() => setLoeschAbfrage(true)}
                  leftIcon={<i className="ti ti-trash" aria-hidden="true" />}>
                  Löschen
                </Button>
              </div>
            )}
          </>
        )}
      </header>

      {/* Items */}
      {sammlung.items.length === 0 ? (
        <p style={{ margin: 0, padding: '8px 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Noch nichts in dieser Sammlung. Über „In Sammlung" bei einem Rezept oder Beitrag kommt hier etwas hinein.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
          {sammlung.items.map(item => (
            <div key={itemKey(item)} style={{ position: 'relative' }}>
              {item.item_type === 'recipe' && item.recipe && (
                <RecipeCard recipe={item.recipe} onClick={() => navigate(`/recipes/${item.recipe.id}`)} />
              )}
              {item.item_type === 'external_post' && item.external_post && (
                <PostKachel post={item.external_post} onClick={() => setOffenerPost(item.external_post)} />
              )}
              {istOwner && (
                <button
                  onClick={() => entfernen(item)}
                  data-track-id="collection-detail-item-remove"
                  aria-label="Aus Sammlung entfernen"
                  title="Aus Sammlung entfernen"
                  style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    width: 26, height: 26, borderRadius: 'var(--radius-pill)',
                    background: 'rgba(0,0,0,.55)', border: 'none', cursor: 'pointer',
                    color: 'var(--on-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {offenerPost && (
        <PostOverlay post={offenerPost} onClose={() => setOffenerPost(null)} />
      )}

      {loeschAbfrage && (
        <LoeschDialog
          name={sammlung.name}
          laeuft={speichert}
          onAbbrechen={() => setLoeschAbfrage(false)}
          onBestaetigen={loeschen}
        />
      )}
    </Rahmen>
  )
}

function Rahmen({ children }) {
  return (
    <div className="px-4 md:px-8" style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 16, paddingBottom: 132, maxWidth: 960, margin: '0 auto', width: '100%' }}>
      {children}
    </div>
  )
}

function Sichtbarkeitswahl({ wert, onChange }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="ui-field__label" style={{ padding: 0 }}>Sichtbarkeit</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {SICHTBARKEIT_OPTIONEN.map(o => (
          <label key={o.wert} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
            <input
              type="radio"
              name="visibility"
              value={o.wert}
              checked={wert === o.wert}
              onChange={() => onChange(o.wert)}
              data-track-id={`collection-visibility-${o.wert}`}
              style={{ marginTop: 3, accentColor: 'var(--accent)' }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{o.label}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{o.hinweis}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function LoeschDialog({ name, laeuft, onAbbrechen, onBestaetigen }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onAbbrechen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAbbrechen])

  return (
    <div
      onClick={onAbbrechen}
      role="dialog"
      aria-modal="true"
      aria-label="Sammlung löschen"
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', padding: '1.6rem', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 .5rem', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
          Sammlung löschen?
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.55, color: 'var(--subtext)' }}>
          „{name}" wird gelöscht. Die enthaltenen Rezepte und Beiträge bleiben erhalten — nur die Sammlung verschwindet.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onAbbrechen} disabled={laeuft} trackId="collection-delete-cancel">
            Abbrechen
          </Button>
          <Button variant="primary" size="sm" onClick={onBestaetigen} disabled={laeuft} trackId="collection-delete-confirm">
            {laeuft ? 'Wird gelöscht …' : 'Löschen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
