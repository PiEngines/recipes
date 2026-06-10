import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

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

  useEffect(() => {
    client.get(`/api/recipes/${id}`)
      .then(({ data }) => setRecipe(data))
      .catch(() => navigate('/'))
  }, [id, navigate])

  useEffect(() => {
    if (!recipe) return
    const step = recipe.steps[stepIdx]
    if (!step) return
    setLoadingStep(true)
    client.get(`/api/recipes/${id}/steps/${step.id}/ingredients`)
      .then(({ data }) => {
        setStepData(data)
        setSelectedIds(new Set(data.ingredients.map(i => i.id)))
      })
      .catch(() => setStepData({ ingredients: [], suspicious_tokens: [] }))
      .finally(() => setLoadingStep(false))
  }, [recipe, stepIdx, id])

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

  const renderInstruction = () => {
    const tokens = stepData.suspicious_tokens
    if (!tokens.length) return step.instruction
    const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi')
    const parts = step.instruction.split(pattern)
    return parts.map((part, i) =>
      tokens.some(t => t.toLowerCase() === part.toLowerCase())
        ? (
          <span
            key={i}
            title="Zutat nicht in Liste"
            style={{ textDecoration: 'underline wavy #C8602A', textDecorationThickness: '2px', cursor: 'help' }}
          >
            {part}
          </span>
        )
        : <span key={i}>{part}</span>
    )
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
    </div>
  )
}
