/**
 * CollectionFormModal (F3b-2b) — Sammlung anlegen.
 *
 * Eigenständig gehalten, weil zwei Stellen sie brauchen: der „Gespeichert"-Tab
 * und der Sammlungs-Picker („+ Neue Sammlung", Commit 3). Die Komponente legt
 * an und reicht die fertige `CollectionSummary` nach oben — was danach
 * passiert (in die Liste einsortieren, direkt befüllen, hinnavigieren),
 * entscheidet der Aufrufer.
 */
import { useEffect, useState } from 'react'

import { createCollection } from '../api/collections'
import { Button, Input } from '../components/ui'

const SICHTBARKEIT_OPTIONEN = [
  { wert: 'private', label: 'Privat', hinweis: 'Nur du siehst diese Sammlung.' },
  { wert: 'public', label: 'Öffentlich', hinweis: 'Auf deinem Profil sichtbar.' },
]

export default function CollectionFormModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  const absenden = async e => {
    e.preventDefault()
    const sauber = name.trim()
    if (!sauber) {
      setFehler('Bitte gib der Sammlung einen Namen.')
      return
    }
    setLaeuft(true)
    setFehler('')
    try {
      const angelegt = await createCollection({ name: sauber, visibility })
      onCreated(angelegt)
    } catch {
      setFehler('Konnte nicht angelegt werden. Bitte versuch es erneut.')
      setLaeuft(false)
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Neue Sammlung"
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--hairline)', padding: '1.6rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 1.1rem', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
          Neue Sammlung
        </h2>

        <form onSubmit={absenden} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. Sonntagsbraten"
            maxLength={255}
            autoFocus
            trackId="collection-create-name-input"
          />

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="ui-field__label" style={{ padding: 0 }}>Sichtbarkeit</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {SICHTBARKEIT_OPTIONEN.map(o => (
                <label key={o.wert} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="new-collection-visibility"
                    value={o.wert}
                    checked={visibility === o.wert}
                    onChange={() => setVisibility(o.wert)}
                    data-track-id={`collection-create-visibility-${o.wert}`}
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

          {fehler && (
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
              {fehler}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={laeuft} trackId="collection-create-cancel">
              Abbrechen
            </Button>
            <Button type="submit" size="sm" disabled={laeuft} trackId="collection-create-submit">
              {laeuft ? 'Wird angelegt …' : 'Anlegen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
