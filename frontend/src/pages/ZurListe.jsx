// „Zur Liste hinzufügen" (SPEC §10, screens/shoppingliste.html — Screen 1)
//
// Übernimmt Zutaten eines Rezepts in die Einkaufsliste. Die Mengen werden auf
// die im Detail gewählten Portionen skaliert und beim Speichern eingefroren —
// die Skalierung selbst passiert im Backend (utils.scaling), damit Liste und
// Rezeptansicht dieselbe Quelle haben.
//
// v1: alle Zutaten vorausgewählt, keine Pantry-Ausnahme (→ Merkliste).

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import { addFromRecipe } from '../api/shopping'
import BackButton from '../components/BackButton'

export default function ZurListe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  // Portionen kommen aus RecipeDetail (State oder ?servings=), sonst Rezept-Basis.
  const servingsFromNav =
    location.state?.servings ??
    Number(new URLSearchParams(location.search).get('servings')) ??
    null

  useEffect(() => {
    const controller = new AbortController()
    client.get(`/api/recipes/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        setRecipe(data)
        setSelected(new Set((data.ingredients || []).map(i => i.id)))
        document.title = `Zur Einkaufsliste – ${data.title} – PiEngines Recipes`
      })
      .catch(err => { if (err.name !== 'CanceledError') navigate(`/recipes/${id}`) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, navigate])

  const servings = useMemo(() => {
    const fromNav = Number(servingsFromNav)
    if (Number.isFinite(fromNav) && fromNav > 0) return fromNav
    return recipe?.servings || 4
  }, [servingsFromNav, recipe])

  const ingredients = recipe?.ingredients || []
  const alleGewaehlt = ingredients.length > 0 && selected.size === ingredients.length

  const toggle = (ingId) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(ingId)) next.delete(ingId)
      else next.add(ingId)
      return next
    })
  }

  const toggleAlle = () => {
    setSelected(alleGewaehlt ? new Set() : new Set(ingredients.map(i => i.id)))
  }

  const submit = async () => {
    if (selected.size === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const anzahl = selected.size
      await addFromRecipe({
        recipeId: Number(id),
        servings,
        ingredientIds: [...selected],
      })
      // Zurück ins Rezept statt in die Einkaufsliste: der Ruecksprung gehört
      // zum Rezept-Kontext, aus dem man kam. `replace`, weil dieser Screen
      // erledigt ist und im Zurück-Weg nichts mehr zu suchen hat.
      navigate(`/recipes/${id}`, {
        replace: true,
        state: {
          listeHinweis: anzahl === 1
            ? '1 Zutat zur Einkaufsliste hinzugefügt.'
            : `${anzahl} Zutaten zur Einkaufsliste hinzugefügt.`,
        },
      })
    } catch {
      setError('Die Zutaten konnten nicht übernommen werden. Bitte versuch es noch einmal.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
          <div className="skeleton-block" style={{ height: 60, borderRadius: 'var(--radius-card)', marginBottom: 14 }} />
          <div className="skeleton-block" style={{ height: 300, borderRadius: 'var(--radius-card)' }} />
        </div>
      </div>
    )
  }

  if (!recipe) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 7rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton fallback={`/recipes/${id}`} />
        </div>

        {/* Titelband */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Zur Liste hinzufügen · Rezept
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(20px, 4vw, 26px)', lineHeight: 1.1, color: 'var(--text)' }}>
            {recipe.title}
          </h1>
          <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            Mengen für {servings} Portion{servings === 1 ? '' : 'en'}
          </p>
        </div>

        {error && (
          <p role="status" style={{ margin: '0 0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {ingredients.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Dieses Rezept hat keine Zutaten hinterlegt.
          </p>
        ) : (
          <>
            {/* Alle auswählen */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--hairline)', marginBottom: 4 }}>
              <button
                onClick={toggleAlle}
                data-track-id="zur-liste-select-all"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}
              >
                {alleGewaehlt ? 'Auswahl aufheben' : 'Alle auswählen'}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {selected.size} von {ingredients.length}
              </span>
            </div>

            <section id="zur-liste-zutaten" aria-label="Zutaten auswählen">
              {ingredients.map(ing => {
                const an = selected.has(ing.id)
                const menge = [ing.amount, ing.unit].filter(Boolean).join(' ')
                return (
                  <button
                    key={ing.id}
                    onClick={() => toggle(ing.id)}
                    aria-pressed={an}
                    data-track-id="zur-liste-ingredient-toggle"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 2px', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--hairline)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
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
                      {ing.name}
                    </span>
                  </button>
                )
              })}
            </section>

            {/* CTA — liegt bewusst über der Suchleiste (z 97). Die Bottom-Nav
                und ihr »Mehr«-Panel liegen seit BUG-55 darüber (z 102–104),
                damit das Panel nicht vom CTA verdeckt wird.
                Die globale Suchleiste ist auf diesem Screen ausgeblendet
                (NO_SEARCHBAR_PATTERNS in main.jsx); der z-index hält den CTA
                auch dann klickbar, wenn dort später etwas hinzukommt.
                Abstand unten: mobil über der 78 px hohen Nav, ab md ohne Nav. */}
            <div
              className="bottom-[78px] md:bottom-4"
              style={{ position: 'fixed', left: 0, right: 0, zIndex: 101, padding: '0 1.25rem', pointerEvents: 'none' }}
            >
              <div style={{ maxWidth: 760, margin: '0 auto', pointerEvents: 'auto' }}>
                <button
                  onClick={submit}
                  disabled={selected.size === 0 || saving}
                  data-track-id="zur-liste-submit"
                  style={{
                    width: '100%', padding: '14px 18px', borderRadius: 'var(--radius-input)', border: 'none',
                    background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--btn-edge)',
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                    cursor: selected.size === 0 || saving ? 'default' : 'pointer',
                    opacity: selected.size === 0 || saving ? 0.5 : 1,
                  }}
                >
                  {saving
                    ? 'Wird übernommen …'
                    : `${selected.size} Zutat${selected.size === 1 ? '' : 'en'} zur Einkaufsliste →`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
