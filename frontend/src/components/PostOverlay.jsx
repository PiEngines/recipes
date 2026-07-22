/**
 * PostOverlay — der abspielbare Beitrag, geöffnet aus einer `PostKachel`.
 *
 * Erst hier entsteht der eigentliche Embed: `ExternalPostEmbed` wird mit dem
 * Overlay montiert, lädt den Player-iFrame also genau dann, wenn jemand den
 * Beitrag wirklich sehen will — nicht schon beim Scrollen durch den Feed.
 *
 * Zwei Zonen: oben die Media-Zone, die den Rest des Platzes bekommt und bei
 * Bedarf selbst scrollt (Reels sind hochkant und oft höher als der Viewport),
 * unten eine fest verankerte Aktionszone. Die Aktionen liegen bewusst *nicht*
 * im Scroll-Fluss — sonst schiebt der Player sie unter die Falz und man muss am
 * Video vorbeiscrollen, um sie zu erreichen.
 *
 * Die Aktionen öffnen ihr Formular als Bottom-Sheet in derselben Zone, statt
 * als zweites Fullscreen-Overlay: der Beitrag bleibt sichtbar, während man
 * wählt. `inSammlung` blendet „In Sammlung" ein, „Zur Liste" erscheint, sobald
 * der Beitrag erkannte Zutaten hat.
 *
 * Muster wie `MediaLightbox`: abgedunkelter Hintergrund, Schließen per ✕,
 * Backdrop-Klick und Escape, Body-Scroll gesperrt. Escape, Backdrop und der
 * Scrim über dem Video wirken gestaffelt — offenes Sheet zuerst, erst danach
 * das Overlay.
 */
import { useEffect, useState } from 'react'

import { getPost } from '../api/externalPosts'
import { addManual } from '../api/shopping'
import CollectionPicker from './CollectionPicker'
import ExternalPostEmbed from './ExternalPostEmbed'
import { Button } from './ui'

// Mengen-Vorspann einer extrahierten Zutat: „200 g" — fehlende Teile fallen
// weg, ohne Menge bleibt der Vorspann leer.
function mengenText(z) {
  return [z?.amount, z?.unit].filter(Boolean).join(' ')
}

export default function PostOverlay({ post, onClose, inSammlung = false }) {
  const [sheet, setSheet] = useState(null)          // null | 'sammlung' | 'liste'
  const [zutaten, setZutaten] = useState([])
  const [gewaehlt, setGewaehlt] = useState(() => new Set())
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)

  const sheetOffen = sheet !== null

  // Eine Ebene zurück: erst das Sheet, dann das Overlay.
  const zurueck = () => {
    if (sheetOffen) setSheet(null)
    else onClose()
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (sheetOffen) setSheet(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sheetOffen])

  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  // Die Zutaten stecken nur im Detail-Schema — Feed und Sammlungen liefern die
  // schlanke Form ohne sie. Der Detail-Endpunkt ist nicht owner-beschränkt, der
  // Nachschlag klappt also auch bei fremden Beiträgen. Scheitert er (fehlende
  // Rolle, Netz), bleibt die Liste leer und die Aktion einfach aus.
  useEffect(() => {
    if (!post?.id) return undefined

    if (Array.isArray(post.extracted_ingredients)) {
      setZutaten(post.extracted_ingredients)
      return undefined
    }

    const controller = new AbortController()
    getPost(post.id, { signal: controller.signal })
      .then(detail => {
        setZutaten(Array.isArray(detail.extracted_ingredients) ? detail.extracted_ingredients : [])
      })
      .catch(() => setZutaten([]))
    return () => controller.abort()
  }, [post])

  // Vorauswahl: alles angehakt — wer nur einzelne Zutaten braucht, hakt ab.
  useEffect(() => {
    setGewaehlt(new Set(zutaten.map((_, i) => i)))
  }, [zutaten])

  // Nach der Rückmeldung schließt das Sheet von selbst — hier ist nichts mehr
  // zu entscheiden.
  useEffect(() => {
    if (!ergebnis) return undefined
    const t = setTimeout(() => { setSheet(null); setErgebnis(null) }, 1400)
    return () => clearTimeout(t)
  }, [ergebnis])

  const umschalten = index => {
    setGewaehlt(vorher => {
      const naechste = new Set(vorher)
      if (naechste.has(index)) naechste.delete(index)
      else naechste.add(index)
      return naechste
    })
  }

  const aufListe = async () => {
    const auswahl = zutaten.filter((_, i) => gewaehlt.has(i))
    if (!auswahl.length) return

    setLaeuft(true)
    try {
      // Nacheinander statt parallel: die Reihenfolge in der Liste soll der im
      // Beitrag entsprechen.
      for (const z of auswahl) {
        await addManual({ name: z.name, amount: z.amount, unit: z.unit })
      }
      setErgebnis(auswahl.length === 1
        ? '1 Zutat hinzugefügt.'
        : `${auswahl.length} Zutaten hinzugefügt.`)
    } catch {
      setErgebnis('Konnte nicht hinzugefügt werden. Bitte versuch es erneut.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!post) return null

  const zurListe = zutaten.length > 0
  const aktionen = inSammlung || zurListe

  return (
    <div
      onClick={zurueck}
      role="dialog"
      aria-modal="true"
      aria-label="Verlinkter Beitrag"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.9)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <button
        onClick={onClose}
        data-track-id="home-feed-post-close"
        aria-label="Schließen"
        style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 2,
          width: 44, height: 44, borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,255,255,.12)', border: 'none',
          color: 'var(--on-dark)', fontSize: '1.25rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {/* Media-Zone: nimmt den Platz oberhalb der Aktionszone ein und scrollt
          selbst, wenn der Player höher ist. Der Scroller liegt absolut in einem
          eigenen Rahmen, damit der Scrim darüber stehen bleibt statt
          mitzuscrollen. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '64px 16px 16px' }}>
          {/* Klicks im Inhalt dürfen das Overlay nicht schließen — sonst wäre der
              Player nicht bedienbar. */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}
          >
            <ExternalPostEmbed post={post} />
          </div>
        </div>

        {/* Bei offenem Sheet fängt ein Scrim die Taps über dem Video ab. Ohne
            ihn landet der Tap im Cross-Origin-iFrame und kommt hier nie an —
            das Sheet ließe sich über dem Video nicht schließen. */}
        {sheetOffen && (
          <div
            onClick={() => setSheet(null)}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)' }}
          />
        )}
      </div>

      {/* Aktionszone: am Overlay-Boden verankert, damit die Aktionen unabhängig
          von der Player-Höhe erreichbar bleiben. Offen zeigt sie das jeweilige
          Sheet, sonst nur die Buttons — die Steuerleiste des Players bleibt so
          frei. */}
      {aktionen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            flexShrink: 0,
            background: sheetOffen
              ? 'var(--surface)'
              : 'linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.55))',
            borderTop: sheetOffen ? '1px solid var(--hairline)' : 'none',
            borderRadius: sheetOffen ? 'var(--radius-card) var(--radius-card) 0 0' : 0,
            padding: sheetOffen
              ? '1.25rem 1rem calc(1rem + env(safe-area-inset-bottom))'
              : '12px 16px calc(12px + env(safe-area-inset-bottom))',
            maxHeight: sheetOffen ? '62vh' : undefined,
            display: sheetOffen ? 'flex' : 'block',
            flexDirection: 'column',
          }}
        >
          <div style={{
            maxWidth: 560, margin: '0 auto', width: '100%',
            display: 'flex', flexDirection: 'column', minHeight: 0,
            ...(sheetOffen ? { flex: 1 } : null),
          }}>
            {sheet === 'sammlung' && (
              <CollectionPicker
                embedded
                itemType="external_post"
                itemId={post.id}
                onClose={() => setSheet(null)}
              />
            )}

            {sheet === 'liste' && (
              <>
                <h2 style={{ margin: '0 0 1rem', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
                  Zur Einkaufsliste
                </h2>

                {ergebnis ? (
                  <p style={{ margin: '0 0 .25rem', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)' }}>
                    <i className="ti ti-check" aria-hidden="true" style={{ fontSize: 16, color: 'var(--green)' }} />
                    {ergebnis}
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => setGewaehlt(vorher => (
                        vorher.size === zutaten.length ? new Set() : new Set(zutaten.map((_, i) => i))
                      ))}
                      data-track-id="post-overlay-liste-alle"
                      style={{
                        alignSelf: 'flex-start', marginBottom: 8, padding: 0,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                        textTransform: 'uppercase', color: 'var(--accent)',
                      }}
                    >
                      {gewaehlt.size === zutaten.length ? 'Keine' : 'Alle'}
                    </button>

                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -.25rem' }}>
                      {zutaten.map((z, i) => {
                        const an = gewaehlt.has(i)
                        const menge = mengenText(z)
                        return (
                          <button
                            key={i}
                            onClick={() => umschalten(i)}
                            disabled={laeuft}
                            aria-pressed={an}
                            data-track-id="post-overlay-liste-toggle"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                              padding: '10px .25rem', textAlign: 'left',
                              background: 'none', border: 'none',
                              borderBottom: '1px solid var(--hairline)',
                              cursor: laeuft ? 'default' : 'pointer',
                            }}
                          >
                            {/* Kästchen wie in `ZurListe` — gleiche Geste, gleiche Optik. */}
                            <span
                              aria-hidden="true"
                              style={{
                                width: 21, height: 21, flexShrink: 0, borderRadius: 5,
                                border: an ? 'none' : '1.5px solid var(--border-input)',
                                background: an ? 'var(--green)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {an && <i className="ti ti-check" style={{ fontSize: 13, color: 'var(--on-accent)' }} />}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: an ? 'var(--text)' : 'var(--text-muted)' }}>
                              {menge && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: an ? 'var(--gold)' : 'var(--text-muted)' }}>
                                  {menge}{' '}
                                </span>
                              )}
                              {z.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <Button size="sm" trackId="post-overlay-liste-submit"
                        onClick={aufListe}
                        disabled={laeuft || gewaehlt.size === 0}
                        leftIcon={<i className="ti ti-shopping-cart" aria-hidden="true" />}>
                        {laeuft ? 'Wird hinzugefügt …' : `Hinzufügen (${gewaehlt.size})`}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSheet(null)} trackId="post-overlay-liste-cancel">
                        Abbrechen
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {!sheetOffen && (
              <div style={{ display: 'flex', gap: 8 }}>
                {inSammlung && (
                  <button
                    onClick={() => setSheet('sammlung')}
                    data-track-id="post-overlay-in-sammlung"
                    style={{
                      flex: 1, padding: '11px 16px',
                      borderRadius: 'var(--radius-input)', cursor: 'pointer',
                      background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.3)',
                      color: 'var(--on-dark)',
                      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    <i className="ti ti-books" aria-hidden="true" style={{ fontSize: 15 }} /> In Sammlung
                  </button>
                )}
                {zurListe && (
                  <button
                    onClick={() => setSheet('liste')}
                    data-track-id="post-overlay-zur-liste"
                    style={{
                      flex: 1, padding: '11px 16px',
                      borderRadius: 'var(--radius-input)', cursor: 'pointer',
                      background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.3)',
                      color: 'var(--on-dark)',
                      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    <i className="ti ti-shopping-cart" aria-hidden="true" style={{ fontSize: 15 }} /> Zur Liste
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
