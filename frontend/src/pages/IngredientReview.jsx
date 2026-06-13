import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import StepSuggestionDialog from '../components/StepSuggestionDialog'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Lade Zutaten-Abgleich …</p>
      </div>
    </div>
  )
}

export default function IngredientReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [stepData, setStepData] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loadingStep, setLoadingStep] = useState(true)
  const [saving, setSaving] = useState(false)

  // Unmatched-step-token suggestions, keyed by step id
  const [suggestionsMap, setSuggestionsMap] = useState({})
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false)
  const [dialogSuggestion, setDialogSuggestion] = useState(null)
  const [suggestionSaving, setSuggestionSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const autoOpenedSteps = useRef(new Set())

  useEffect(() => {
    client.get(`/api/recipes/${id}`)
      .then(({ data }) => {
        setRecipe(data)
        if (!data.steps || data.steps.length === 0) {
          navigate(`/recipes/${data.id}`)
          return
        }
      })
      .catch(() => navigate('/recipes'))
  }, [id, navigate])

  useEffect(() => {
    client.get(`/api/recipes/${id}/step-suggestions`)
      .then(({ data }) => {
        const map = {}
        for (const group of data) map[String(group.step_id)] = group.suggestions
        setSuggestionsMap(map)
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoaded(true))
  }, [id])

  useEffect(() => {
    if (!recipe) return
    const step = recipe.steps[stepIdx]
    if (!step) return
    setLoadingStep(true)
    setDialogSuggestion(null)
    setFeedback(null)
    client.get(`/api/recipes/${id}/steps/${step.id}/ingredients`)
      .then(({ data }) => {
        setStepData(data)
        setSelectedIds(new Set(data.ingredients.map(i => i.id)))
      })
      .catch(() => setStepData({ ingredients: [], suspicious_tokens: [] }))
      .finally(() => setLoadingStep(false))
  }, [recipe, stepIdx, id])

  // Auto-open the dialog once per step for "eindeutig" suggestions
  useEffect(() => {
    if (!recipe || !suggestionsLoaded) return
    const step = recipe.steps[stepIdx]
    if (!step) return
    if (autoOpenedSteps.current.has(stepIdx)) return
    const eindeutig = (suggestionsMap[String(step.id)] || []).find(
      s => s.confidence === 'eindeutig'
    )
    if (eindeutig) {
      autoOpenedSteps.current.add(stepIdx)
      setDialogSuggestion(eindeutig)
    }
  }, [recipe, stepIdx, suggestionsLoaded, suggestionsMap])

  // Inline feedback auto-dismiss
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 2500)
    return () => clearTimeout(t)
  }, [feedback])

  if (!recipe || loadingStep || !stepData) return <LoadingScreen />

  const step = recipe.steps[stepIdx]
  const total = recipe.steps.length
  const isLast = stepIdx === total - 1

  const toggle = (ingId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(ingId)) next.delete(ingId)
      else next.add(ingId)
      return next
    })
  }

  const stepSuggestions = suggestionsMap[String(step.id)] || []
  const openVerdachtSuggestions = stepSuggestions.filter(s => s.status === 'open' && s.confidence === 'verdacht')

  const renderInstruction = () => {
    const suspicious = stepData.suspicious_tokens
    const tokenMap = new Map()
    for (const t of suspicious) {
      tokenMap.set(t.toLowerCase(), { type: 'suspicious' })
    }
    for (const s of openVerdachtSuggestions) {
      tokenMap.set(s.token.toLowerCase(), { type: 'suggestion', suggestion: s })
    }
    if (tokenMap.size === 0) return step.instruction

    const pattern = new RegExp(`(${[...tokenMap.keys()].map(escapeRegExp).join('|')})`, 'gi')
    const parts = step.instruction.split(pattern)
    return parts.map((part, i) => {
      const entry = tokenMap.get(part.toLowerCase())
      if (!entry) return <span key={i}>{part}</span>
      if (entry.type === 'suggestion') {
        return (
          <span
            key={i}
            onClick={() => setDialogSuggestion(entry.suggestion)}
            title="Mögliche Zutat gefunden"
            style={{ textDecoration: 'underline dashed #C8602A', textDecorationThickness: '2px', cursor: 'pointer' }}
          >
            {part}
          </span>
        )
      }
      return (
        <span
          key={i}
          title="Zutat nicht in Liste"
          style={{ textDecoration: 'underline wavy #C8602A', textDecorationThickness: '2px', cursor: 'help' }}
        >
          {part}
        </span>
      )
    })
  }

  // A suggestion's token may appear in multiple steps; collect all step ids
  // that currently have an open suggestion for the same token.
  const findStepIdsForToken = (token) => {
    const lower = token.toLowerCase()
    const ids = []
    for (const [stepId, sugs] of Object.entries(suggestionsMap)) {
      if (sugs.some(s => s.token.toLowerCase() === lower && s.status === 'open')) {
        ids.push(Number(stepId))
      }
    }
    return ids.length ? ids : [step.id]
  }

  const removeSuggestionsByToken = (token) => {
    const lower = token.toLowerCase()
    setSuggestionsMap(prev => {
      const next = {}
      for (const [stepId, sugs] of Object.entries(prev)) {
        next[stepId] = sugs.filter(s => s.token.toLowerCase() !== lower)
      }
      return next
    })
  }

  const removeSuggestionById = (suggestionId) => {
    setSuggestionsMap(prev => {
      const next = {}
      for (const [stepId, sugs] of Object.entries(prev)) {
        next[stepId] = sugs.filter(s => s.id !== suggestionId)
      }
      return next
    })
  }

  const handleAcceptSuggestion = async ({ name, quantity, unit }) => {
    if (!dialogSuggestion) return
    setSuggestionSaving(true)
    try {
      await client.post(`/api/recipes/${id}/step-suggestions/${dialogSuggestion.id}/accept`, {
        name,
        quantity: String(quantity),
        unit,
        step_ids: findStepIdsForToken(dialogSuggestion.token),
      })
      removeSuggestionsByToken(dialogSuggestion.token)
      setDialogSuggestion(null)
      setFeedback('Zutat hinzugefügt')
    } catch {
      setFeedback('Hinzufügen fehlgeschlagen')
    } finally {
      setSuggestionSaving(false)
    }
  }

  const handleDismissSuggestion = async () => {
    if (!dialogSuggestion) return
    setSuggestionSaving(true)
    try {
      await client.post(`/api/recipes/${id}/step-suggestions/${dialogSuggestion.id}/dismiss`)
      removeSuggestionById(dialogSuggestion.id)
      setDialogSuggestion(null)
      setFeedback('Übersprungen')
    } catch {
      setFeedback('Fehler beim Überspringen')
    } finally {
      setSuggestionSaving(false)
    }
  }

  const handleNext = async () => {
    if (saving) return
    setSaving(true)
    try {
      await client.patch(`/api/recipes/${id}/steps/${step.id}/ingredients`, { ingredient_ids: [...selectedIds] })
      if (isLast) {
        await client.post(`/api/recipes/${id}/matching-review`)
        navigate(`/recipes/${id}`)
      } else {
        setStepIdx(i => i + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '640px', background: 'var(--card)', borderRadius: 'var(--radius-lg, 16px)', border: '1px solid var(--border-input)', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.25rem', fontFamily: 'Inter, sans-serif' }}>
            Zutaten-Abgleich
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)' }}>
            Schritt {stepIdx + 1} von {total}
          </p>
          <div style={{ display: 'flex', gap: '4px', marginTop: '0.75rem' }}>
            {recipe.steps.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: i <= stepIdx ? '#C8602A' : 'var(--border-input)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Step instruction */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border-input)' }}>
          {step.title && (
            <div style={{ fontWeight: 600, marginBottom: '0.4rem', fontFamily: 'Inter, sans-serif' }}>{step.title}</div>
          )}
          <div style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>{renderInstruction()}</div>
          {feedback && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#C8602A', fontFamily: 'Inter, sans-serif' }}>
              ✓ {feedback}
            </div>
          )}
        </div>

        {/* Ingredient chips */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--subtext)', marginBottom: '0.6rem', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Welche Zutaten gehören zu diesem Schritt?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {recipe.ingredients.map(ing => {
              const active = selectedIds.has(ing.id)
              return (
                <button
                  key={ing.id}
                  onClick={() => toggle(ing.id)}
                  style={{
                    padding: '0.4rem 0.9rem',
                    borderRadius: 'var(--radius-pill)',
                    border: `1.5px solid ${active ? '#C8602A' : 'var(--border-input)'}`,
                    background: active ? '#C8602A' : 'transparent',
                    color: active ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    transition: 'var(--transition)',
                  }}
                >
                  {ing.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: '#C8602A',
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
            fontSize: '0.95rem',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
            transition: 'var(--transition)',
          }}
        >
          {saving ? 'Speichern …' : isLast ? 'Fertig' : 'Weiter'}
        </button>
      </div>

      {dialogSuggestion && (
        <StepSuggestionDialog
          suggestion={dialogSuggestion}
          saving={suggestionSaving}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onClose={() => setDialogSuggestion(null)}
        />
      )}
    </div>
  )
}
