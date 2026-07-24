// 14 · Instagram / TikTok — Integration (SPEC §14, screens/social-integration.html)
//
// BEWUSSTE ABWEICHUNG vom Prototyp (Lead-entschieden, F3b-1):
// Der Screen zeigt einen OAuth-Flow („Konto verbinden → deine Beiträge laden →
// auswählen"). OAuth ist bewusst weggeschoben. Statt dessen der manuelle Weg:
// der User fügt die Beitrags-URL selbst ein (in Instagram: Teilen → „Link
// kopieren"), wir zeigen eine Vorschau und speichern. Alles Übrige aus §14 gilt
// unverändert — Plattform-Toggle, Verknüpfung mit einem Rezept, „Rezept
// ansehen", eingebettetes Reel.
//
// Weitere Abweichung: Instagram liefert per oEmbed keine Caption. Die
// Zutaten-Extraktion braucht sie — deshalb dort das Feld „Beschreibung
// einfügen", das es im Prototyp nicht gibt.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import {
  createPost, deletePost, getPost, getPosts, patchPost,
  platformAusUrl, previewPost, refreshPost, toShoppingList,
} from '../api/externalPosts'
import ExternalPostEmbed from '../components/ExternalPostEmbed'

const PLATTFORMEN = [
  { key: 'alle', label: 'ALLE' },
  { key: 'instagram', label: 'INSTAGRAM' },
  { key: 'tiktok', label: 'TIKTOK' },
]

const LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }

// ── kleine Bausteine ─────────────────────────────────────────────────────────

const overline = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const feld = {
  width: '100%',
  border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  padding: '9px 11px',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

function Hinweis({ ton = 'neutral', children }) {
  return (
    <div style={{
      display: 'flex', gap: 9, padding: '12px 13px', borderRadius: 'var(--radius-card)',
      background: 'var(--bg-alt)',
      borderLeft: `3px solid ${ton === 'gut' ? 'var(--green)' : 'var(--wood-shadow)'}`,
    }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
        {children}
      </p>
    </div>
  )
}

// ── Beitrag hinzufügen ───────────────────────────────────────────────────────

// `startOpen` + `onCancel` machen die Komponente auf dem reinen Erstellen-Screen
// (/social/new) wiederverwendbar: dort startet sie direkt ausgeklappt, und
// „Abbrechen" navigiert zurück statt zur eingebetteten Sammelform zu kollabieren.
export function AddPostForm({ onSaved, startOpen = false, onCancel }) {
  const [open, setOpen] = useState(startOpen)
  const [url, setUrl] = useState('')
  const [vorschau, setVorschau] = useState(null)
  const [status, setStatus] = useState('leer')  // leer | laedt | bereit | fehler
  const [fehler, setFehler] = useState('')

  const platform = useMemo(() => platformAusUrl(url), [url])

  const zuruecksetzen = () => {
    setUrl(''); setVorschau(null); setStatus('leer'); setFehler('')
  }

  const holeVorschau = async () => {
    if (!platform) {
      setFehler('Das sieht nicht nach einem Instagram- oder TikTok-Link aus.')
      return
    }
    setStatus('laedt'); setFehler(''); setVorschau(null)
    try {
      const daten = await previewPost({ platform, url: url.trim() })
      setVorschau(daten)
      setStatus('bereit')
    } catch (err) {
      setStatus('fehler')
      setFehler(err?.response?.status === 502
        ? 'Die Vorschau konnte nicht geladen werden. Ist der Beitrag öffentlich?'
        : 'Der Link konnte nicht geprüft werden.')
    }
  }

  const speichern = async () => {
    setStatus('laedt'); setFehler('')
    try {
      const post = await createPost({ platform, url: url.trim() })
      zuruecksetzen()
      setOpen(false)
      onSaved(post)
    } catch {
      setStatus('bereit')
      setFehler('Der Beitrag konnte nicht gespeichert werden.')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-track-id="social-add-open"
        style={{
          width: '100%', padding: '12px 16px', marginBottom: 20,
          borderRadius: 'var(--radius-input)', cursor: 'pointer',
          border: '1.5px dashed var(--wood-shadow)', background: 'transparent',
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}
      >
        <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 14 }} /> Beitrag hinzufügen
      </button>
    )
  }

  return (
    <section
      id="social-add"
      aria-label="Beitrag hinzufügen"
      style={{
        marginBottom: 20, padding: 14, borderRadius: 'var(--radius-card)',
        background: 'var(--surface)', boxShadow: 'var(--shadow)',
      }}
    >
      <p style={overline}>Beitrag hinzufügen</p>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
        In Instagram oder TikTok auf <em>Teilen → „Link kopieren"</em> tippen und den Link hier einfügen.
      </p>

      <input
        value={url}
        onChange={e => { setUrl(e.target.value); setStatus('leer'); setFehler(''); setVorschau(null) }}
        placeholder="https://www.instagram.com/reel/…"
        aria-label="Beitrags-Link"
        inputMode="url"
        data-track-id="social-add-url"
        style={feld}
      />

      {url.trim() && !platform && (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
          Erkannt werden Links von Instagram und TikTok.
        </p>
      )}
      {platform && (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          Erkannt: {LABEL[platform]}
        </p>
      )}

      {fehler && (
        <p role="status" style={{ margin: '8px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--danger)' }}>
          {fehler}
        </p>
      )}

      {status === 'laedt' && <div className="skeleton-block" style={{ height: 180, borderRadius: 'var(--radius-card)', marginTop: 12 }} />}

      {vorschau && status === 'bereit' && (
        <div style={{ marginTop: 12 }}>
          <ExternalPostEmbed post={vorschau} />
          {vorschau.author_name && (
            <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              von {vorschau.author_name}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {status === 'bereit' ? (
          <button
            onClick={speichern}
            data-track-id="social-add-save"
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-input)', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Speichern
          </button>
        ) : (
          <button
            onClick={holeVorschau}
            disabled={!url.trim() || status === 'laedt'}
            data-track-id="social-add-preview"
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-input)', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
              cursor: !url.trim() || status === 'laedt' ? 'default' : 'pointer',
              opacity: !url.trim() || status === 'laedt' ? 0.5 : 1,
            }}
          >
            {status === 'fehler' ? 'Erneut versuchen' : 'Vorschau'}
          </button>
        )}
        <button
          onClick={() => { zuruecksetzen(); onCancel ? onCancel() : setOpen(false) }}
          data-track-id="social-add-cancel"
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-input)',
            border: '1.5px solid var(--border-input)', background: 'transparent',
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          Abbrechen
        </button>
      </div>
    </section>
  )
}

// ── Zutatenliste (editierbar) ────────────────────────────────────────────────

function Zutatenliste({ zutaten, onChange, onEntfernen }) {
  if (!zutaten.length) return null

  return (
    <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {zutaten.map((zutat, i) => (
        <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={zutat.amount || ''}
            onChange={e => onChange(i, { ...zutat, amount: e.target.value })}
            placeholder="Menge"
            aria-label={`Menge für ${zutat.name}`}
            data-track-id="social-ingredient-amount"
            style={{ ...feld, flex: 1, minWidth: 0 }}
          />
          <input
            value={zutat.unit || ''}
            onChange={e => onChange(i, { ...zutat, unit: e.target.value })}
            placeholder="Einheit"
            aria-label={`Einheit für ${zutat.name}`}
            data-track-id="social-ingredient-unit"
            style={{ ...feld, flex: 1, minWidth: 0 }}
          />
          <input
            value={zutat.name || ''}
            onChange={e => onChange(i, { ...zutat, name: e.target.value })}
            placeholder="Zutat"
            aria-label="Zutat"
            data-track-id="social-ingredient-name"
            style={{ ...feld, flex: 2, minWidth: 0 }}
          />
          <button
            onClick={() => onEntfernen(i)}
            aria-label={`${zutat.name} entfernen`}
            data-track-id="social-ingredient-remove"
            style={{
              flexShrink: 0, background: 'none', border: 'none', padding: 4,
              cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1,
            }}
          >
            <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 13 }} />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Rezept-Picker ────────────────────────────────────────────────────────────

function RezeptPicker({ onWaehlen, onAbbrechen }) {
  const [suche, setSuche] = useState('')
  const [treffer, setTreffer] = useState([])
  const [laedt, setLaedt] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLaedt(true)
      client
        .get('/api/recipes', {
          signal: controller.signal,
          params: { page: 1, page_size: 10, ...(suche.trim() ? { search: suche.trim() } : {}) },
        })
        .then(r => setTreffer(r.data?.items || []))
        .catch(() => { /* Abbruch beim Tippen ist kein Fehler */ })
        .finally(() => setLaedt(false))
    }, 250)  // entprellt: sonst ein Request je Tastendruck

    return () => { clearTimeout(timer); controller.abort() }
  }, [suche])

  return (
    <div style={{ marginBottom: 10 }}>
      <input
        value={suche}
        onChange={e => setSuche(e.target.value)}
        placeholder="Rezept suchen…"
        aria-label="Rezept suchen"
        autoFocus
        data-track-id="social-recipe-search"
        style={feld}
      />
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {laedt && <li style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>lädt…</li>}
        {!laedt && treffer.length === 0 && (
          <li style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
            Keine Rezepte gefunden.
          </li>
        )}
        {treffer.map(rezept => (
          <li key={rezept.id}>
            <button
              onClick={() => onWaehlen(rezept)}
              data-track-id="social-recipe-pick"
              style={{
                width: '100%', textAlign: 'left', padding: '9px 11px', cursor: 'pointer',
                borderRadius: 'var(--radius-input)', border: '1px solid var(--hairline)',
                background: 'var(--surface)', fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--text)',
              }}
            >
              {rezept.title}
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onAbbrechen}
        data-track-id="social-recipe-cancel"
        style={{
          marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        }}
      >
        Abbrechen
      </button>
    </div>
  )
}

// ── Eine Beitrags-Karte ──────────────────────────────────────────────────────

function PostCard({ post, onWeg }) {
  const [daten, setDaten] = useState(post)
  const [zutaten, setZutaten] = useState([])
  const [caption, setCaption] = useState('')
  const [pickerOffen, setPickerOffen] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')
  const [busy, setBusy] = useState(false)

  // Die Liste kommt aus dem Detail-Endpunkt; die Kompaktliste hat sie nicht.
  useEffect(() => {
    const controller = new AbortController()
    getPost(post.id, { signal: controller.signal })
      .then(voll => {
        setDaten(voll)
        setZutaten(Array.isArray(voll.extracted_ingredients) ? voll.extracted_ingredients : [])
        setCaption(voll.caption_text || '')
      })
      .catch(() => { /* Karte bleibt in der Kompaktform */ })
    return () => controller.abort()
  }, [post.id])

  const melde = useCallback((text) => {
    setMeldung(text)
    setFehler('')
  }, [])

  const mitBusy = useCallback(async (fn, fehlertext) => {
    setBusy(true); setFehler(''); setMeldung('')
    try {
      return await fn()
    } catch {
      setFehler(fehlertext)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const captionSpeichern = () => mitBusy(async () => {
    const voll = await patchPost(daten.id, { caption_text: caption || null })
    setDaten(voll)
    setZutaten(Array.isArray(voll.extracted_ingredients) ? voll.extracted_ingredients : [])
    melde('Beschreibung übernommen — Zutaten neu gelesen.')
  }, 'Die Beschreibung konnte nicht gespeichert werden.')

  const zutatenSpeichern = () => mitBusy(async () => {
    const voll = await patchPost(daten.id, {
      extracted_ingredients: zutaten
        .filter(z => (z.name || '').trim())
        .map(z => ({
          name: z.name.trim(),
          amount: z.amount?.trim() || null,
          unit: z.unit?.trim() || null,
          raw: z.raw || null,
        })),
    })
    setDaten(voll)
    setZutaten(Array.isArray(voll.extracted_ingredients) ? voll.extracted_ingredients : [])
    melde('Zutatenliste gespeichert.')
  }, 'Die Zutaten konnten nicht gespeichert werden.')

  const verknuepfen = (rezept) => mitBusy(async () => {
    const voll = await patchPost(daten.id, { recipe_id: rezept.id })
    setDaten(voll)
    setPickerOffen(false)
    melde(`Mit „${rezept.title}" verknüpft.`)
  }, 'Das Rezept konnte nicht verknüpft werden.')

  const loesen = () => mitBusy(async () => {
    const voll = await patchPost(daten.id, { recipe_id: null })
    setDaten(voll)
    melde('Verknüpfung gelöst.')
  }, 'Die Verknüpfung konnte nicht gelöst werden.')

  const aufListe = () => mitBusy(async () => {
    const { created } = await toShoppingList(daten.id)
    melde(created > 0
      ? `${created} ${created === 1 ? 'Zutat' : 'Zutaten'} auf der Einkaufsliste.`
      : 'Es gibt noch keine Zutaten zum Übernehmen.')
  }, 'Die Zutaten konnten nicht übernommen werden.')

  const nachladen = () => mitBusy(async () => {
    const voll = await refreshPost(daten.id)
    setDaten(voll)
    setZutaten(Array.isArray(voll.extracted_ingredients) ? voll.extracted_ingredients : [])
    setCaption(voll.caption_text || '')
    melde('Vorschau neu geladen.')
  }, 'Die Vorschau konnte nicht geladen werden.')

  const entfernen = () => mitBusy(async () => {
    await deletePost(daten.id)
    onWeg(daten.id)
  }, 'Der Beitrag konnte nicht entfernt werden.')

  const istInstagram = daten.platform === 'instagram'

  return (
    <article
      style={{
        marginBottom: 18, padding: 14, borderRadius: 'var(--radius-card)',
        background: 'var(--surface)', boxShadow: 'var(--shadow)',
        opacity: busy ? 0.7 : 1,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className={`ti ti-brand-${daten.platform}`} aria-hidden="true" style={{ fontSize: 17, color: 'var(--text)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
            {daten.author_name || LABEL[daten.platform] || daten.platform}
          </p>
          <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {LABEL[daten.platform] || daten.platform}
          </p>
        </div>
        <button
          onClick={entfernen}
          disabled={busy}
          aria-label="Beitrag entfernen"
          data-track-id="social-post-delete"
          style={{ background: 'none', border: 'none', padding: 4, cursor: busy ? 'default' : 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
        >
          <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 14 }} />
        </button>
      </header>

      <ExternalPostEmbed post={daten} />

      {!daten.oembed_html && (
        <button
          onClick={nachladen}
          disabled={busy}
          data-track-id="social-post-refresh"
          style={{
            marginTop: 8, background: 'none', border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-input)', padding: '7px 12px', cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          }}
        >
          Vorschau erneut laden
        </button>
      )}

      {/* Instagram liefert per oEmbed keine Caption — sie kommt von Hand. */}
      {istInstagram && (
        <div style={{ marginTop: 14 }}>
          <p style={overline}>Beschreibung einfügen</p>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={4}
            placeholder={'Beschreibung des Beitrags einfügen — je Zeile eine Zutat, z. B.\n200 g Feta'}
            aria-label="Beschreibung des Beitrags"
            data-track-id="social-caption-input"
            style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }}
          />
          <button
            onClick={captionSpeichern}
            disabled={busy}
            data-track-id="social-caption-save"
            style={{
              marginTop: 8, padding: '9px 14px', borderRadius: 'var(--radius-input)', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Zutaten daraus lesen
          </button>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <p style={overline}>Zutaten</p>
        <Zutatenliste
          zutaten={zutaten}
          onChange={(i, neu) => setZutaten(zutaten.map((z, j) => (j === i ? neu : z)))}
          onEntfernen={i => setZutaten(zutaten.filter((_, j) => j !== i))}
        />
        {zutaten.length === 0 && (
          <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
            {istInstagram
              ? 'Noch keine Zutaten — füge oben die Beschreibung des Beitrags ein.'
              : 'In der Beschreibung des Beitrags standen keine erkennbaren Zutaten.'}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => setZutaten([...zutaten, { name: '', amount: '', unit: '' }])}
            disabled={busy}
            data-track-id="social-ingredient-add"
            style={{
              padding: '8px 12px', borderRadius: 'var(--radius-input)',
              border: '1.5px dashed var(--wood-shadow)', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Zutat ergänzen
          </button>
          {zutaten.length > 0 && (
            <>
              <button
                onClick={zutatenSpeichern}
                disabled={busy}
                data-track-id="social-ingredients-save"
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-input)',
                  border: '1.5px solid var(--border-input)', background: 'transparent',
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)',
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                Zutaten speichern
              </button>
              <button
                onClick={aufListe}
                disabled={busy}
                data-track-id="social-to-shopping-list"
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-input)', border: 'none',
                  background: 'var(--green)', color: 'var(--on-accent)',
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                Auf Einkaufsliste
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p style={overline}>Verknüpftes Rezept</p>

        {daten.recipe_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link
              to={`/recipes/${daten.recipe_id}`}
              data-track-id="social-recipe-view"
              style={{
                flex: 1, minWidth: 160, padding: '10px 12px', textDecoration: 'none',
                borderRadius: 'var(--radius-input)', background: 'var(--bg-alt)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <i className="ti ti-chef-hat" aria-hidden="true" style={{ fontSize: 15 }} />
              Rezept ansehen
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {daten.recipe_title}
              </span>
            </Link>
            <button
              onClick={loesen}
              disabled={busy}
              aria-label="Verknüpfung lösen"
              data-track-id="social-recipe-unlink"
              style={{ background: 'none', border: 'none', padding: 6, cursor: busy ? 'default' : 'pointer', color: 'var(--danger)', lineHeight: 1 }}
            >
              <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 14 }} />
            </button>
          </div>
        ) : pickerOffen ? (
          <RezeptPicker onWaehlen={verknuepfen} onAbbrechen={() => setPickerOffen(false)} />
        ) : (
          <button
            onClick={() => setPickerOffen(true)}
            disabled={busy}
            data-track-id="social-recipe-link-open"
            style={{
              width: '100%', padding: '11px 0', borderRadius: 'var(--radius-input)',
              border: '1.5px dashed var(--wood-shadow)', background: 'transparent',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.05em',
              color: 'var(--text-muted)', cursor: busy ? 'default' : 'pointer',
            }}
          >
            Mit Rezept verknüpfen
          </button>
        )}
      </div>

      {(meldung || fehler) && (
        <p role="status" style={{
          margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 12,
          color: fehler ? 'var(--danger)' : 'var(--text-muted)',
        }}>
          {fehler || meldung}
        </p>
      )}
    </article>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

export default function Social() {
  const [posts, setPosts] = useState([])
  const [platform, setPlatform] = useState('alle')
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    document.title = 'Verlinkte Beiträge – PiEngines Recipes'
    const controller = new AbortController()
    getPosts({ signal: controller.signal })
      .then(setPosts)
      .catch(err => { if (err.name !== 'CanceledError') setFehler('Die Beiträge konnten nicht geladen werden.') })
      .finally(() => setLaedt(false))
    return () => controller.abort()
  }, [])

  const sichtbar = platform === 'alle' ? posts : posts.filter(p => p.platform === platform)
  const leer = !laedt && posts.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--ink-braun)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 1rem' }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)' }}>
            Social
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(21px, 4vw, 28px)', lineHeight: 1, color: 'var(--on-dark)' }}>
            Verlinkte Beiträge
          </h1>

          {!leer && (
            <div role="tablist" aria-label="Plattform" style={{ display: 'flex', gap: 2, marginTop: 14, background: 'rgba(255,255,255,.08)', borderRadius: 'var(--radius-tag)', padding: 2 }}>
              {PLATTFORMEN.map(p => {
                const aktiv = platform === p.key
                return (
                  <button
                    key={p.key}
                    role="tab"
                    aria-selected={aktiv}
                    onClick={() => setPlatform(p.key)}
                    data-track-id="social-platform-toggle"
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                      borderRadius: 'var(--radius-tag)',
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em',
                      fontWeight: aktiv ? 600 : 400,
                      background: aktiv ? 'var(--on-dark)' : 'transparent',
                      color: aktiv ? 'var(--ink-braun)' : 'rgba(240,232,208,.5)',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 6rem' }}>
        <AddPostForm onSaved={post => setPosts(prev => [post, ...prev])} />

        {fehler && (
          <p role="status" style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
            {fehler}
          </p>
        )}

        {laedt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 220, borderRadius: 'var(--radius-card)' }} />
            ))}
          </div>
        ) : leer ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <i className="ti ti-brand-instagram" aria-hidden="true" style={{ fontSize: 42, color: 'var(--text-muted)' }} />
            <p style={{ margin: '12px 0 16px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
              Noch keine Beiträge verlinkt. Füge einen Instagram- oder TikTok-Link ein — wir lesen die Zutaten heraus
              und du kannst den Beitrag mit einem Rezept verknüpfen.
            </p>
          </div>
        ) : (
          <section id="social-posts" aria-label="Verlinkte Beiträge">
            {sichtbar.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onWeg={id => setPosts(prev => prev.filter(p => p.id !== id))}
              />
            ))}
            {sichtbar.length === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
                Keine Beiträge von {LABEL[platform]}.
              </p>
            )}
          </section>
        )}

        {!leer && (
          <div style={{ marginTop: 20 }}>
            <Hinweis ton="gut">
              Verknüpfte Beiträge zeigen einen <strong>„Rezept ansehen"</strong>-Button, der direkt zum Rezept führt.
            </Hinweis>
          </div>
        )}
      </div>
    </div>
  )
}
