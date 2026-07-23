/**
 * RecipePreview — read-only Vorschau des Rezept-Editors (§05, F3b-2c).
 *
 * Bewusst aus dem **Formularstand** gerendert, nicht aus dem Server-Rezept:
 * so zeigt die Vorschau auch das, was der Autosave noch nicht weggeschrieben
 * hat. Sie ahmt die Detail-Darstellung nach (gleiche Tokens, gleiche
 * Reihenfolge), teilt sich aber keinen Code mit `RecipeDetail` — die Seite
 * lädt über ihre id und bringt Kochmodus, Favoriten und Bewertungen mit,
 * alles Dinge, die eine Vorschau nicht haben soll.
 *
 * Es gibt hier bewusst **keinen** Weg zum Veröffentlichen — nur zurück in den
 * Editor.
 */
import { difficultyLabel } from '../utils/difficulty'

const TYP_LABEL = {
  kochen: 'Kochen', backen: 'Backen', grillen: 'Grillen', braten: 'Braten',
  daempfen: 'Dämpfen', einkochen: 'Einkochen', rohkost: 'Rohkost',
}

const GANG_LABEL = {
  vorspeise: 'Vorspeise', hauptspeise: 'Hauptspeise', beilage: 'Beilage',
  dessert: 'Dessert', snack: 'Snack', gebaeck: 'Gebäck', suppe: 'Suppe',
  fruehstueck: 'Frühstück',
}

function Meta({ label, wert }) {
  if (!wert) return null
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
        {wert}
      </div>
    </div>
  )
}

export default function RecipePreview({
  title, description, prepTime, cookTime, servings, difficulty, type, course, source,
  categories = [], tags = [], ingredients = [], steps = [], onClose,
}) {
  // Zutaten nach Gruppe bündeln — Reihenfolge wie eingegeben.
  const gruppen = []
  for (const zutat of ingredients) {
    if (!zutat.name?.trim()) continue
    const label = zutat.component_label || ''
    let gruppe = gruppen.find(g => g.label === label)
    if (!gruppe) { gruppe = { label, items: [] }; gruppen.push(gruppe) }
    gruppe.items.push(zutat)
  }

  const echteSchritte = steps.filter(s => s.instruction?.trim())
  const zeitGesamt = (parseInt(prepTime) || 0) + (parseInt(cookTime) || 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vorschau"
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg)', overflowY: 'auto' }}
    >
      {/* Kopf — der einzige Ausgang führt zurück in den Editor. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--accent)', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
        <span style={{ color: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500 }}>
          Vorschau
        </span>
        <button
          onClick={onClose}
          data-track-id="recipe-form-preview-close"
          style={{
            background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)',
            color: '#fff', borderRadius: 'var(--radius-pill)', padding: '0.25rem 0.875rem',
            fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Zurück zum Bearbeiten
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
          fontSize: 'clamp(22px, 5vw, 32px)', lineHeight: 1.1, color: 'var(--text)',
        }}>
          {title?.trim() || 'Ohne Titel'}
        </h1>

        {description?.trim() && (
          <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--subtext)', whiteSpace: 'pre-line' }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, margin: '18px 0 0', paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
          <Meta label="Vorbereitung" wert={prepTime !== '' ? `${prepTime} Min.` : null} />
          <Meta label="Zubereitung" wert={cookTime !== '' ? `${cookTime} Min.` : null} />
          <Meta label="Gesamt" wert={zeitGesamt > 0 ? `${zeitGesamt} Min.` : null} />
          <Meta label="Portionen" wert={servings !== '' ? servings : null} />
          <Meta label="Art" wert={TYP_LABEL[type] || type} />
          <Meta label="Gang" wert={GANG_LABEL[course] || course} />
          {/* Wort-Label statt „x/10" — die Skala hat fünf Stufen, und die
              Detailseite benennt sie genauso (BUG-65). */}
          <Meta label="Schwierigkeit" wert={difficultyLabel(difficulty)} />
        </div>

        {(categories.length > 0 || tags.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
            {[...categories, ...tags].map(eintrag => (
              <span
                key={`${eintrag.id}-${eintrag.name}`}
                style={{
                  padding: '4px 11px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-alt)', fontFamily: 'var(--font-body)',
                  fontSize: 12, color: 'var(--subtext)',
                }}
              >
                {eintrag.name}
              </span>
            ))}
          </div>
        )}

        <section aria-label="Zutaten" style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>
            Zutaten
          </h2>
          {gruppen.length === 0 ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
              Noch keine Zutaten erfasst.
            </p>
          ) : gruppen.map(gruppe => (
            <div key={gruppe.label || '_'} style={{ marginBottom: 16 }}>
              {gruppe.label && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {gruppe.label}
                </div>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {gruppe.items.map((zutat, i) => (
                  <li
                    key={zutat._key || i}
                    style={{
                      display: 'flex', gap: 10, padding: '6px 0',
                      borderBottom: '1px solid var(--hairline)',
                      fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)',
                    }}
                  >
                    <span style={{ minWidth: 84, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--gold)' }}>
                      {[zutat.amount, zutat.unit].filter(Boolean).join(' ')}
                    </span>
                    <span>{zutat.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-label="Zubereitung" style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>
            Zubereitung
          </h2>
          {echteSchritte.length === 0 ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
              Noch keine Schritte erfasst.
            </p>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {echteSchritte.map((schritt, i) => (
                <li key={schritt._key || i} style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {schritt.title?.trim() && (
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                        {schritt.title}
                      </div>
                    )}
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--subtext)', whiteSpace: 'pre-line' }}>
                      {schritt.instruction}
                    </p>
                    {schritt.timer_minutes && (
                      <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        ⏱ {schritt.timer_minutes} Min.
                        {!schritt.timer_label_use_title && schritt.timer_label ? ` · ${schritt.timer_label}` : ''}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {source?.trim() && (
          <p style={{ marginTop: 28, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
            Quelle: {source}
          </p>
        )}
      </div>
    </div>
  )
}
