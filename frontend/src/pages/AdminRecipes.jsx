import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import Breadcrumb from '../components/Breadcrumb'

const TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'reviews', label: 'Ausstehende Reviews' },
  { key: 'papierkorb', label: 'Papierkorb' },
]

// Map old tab keys for backward compatibility
const TAB_MAP = { all: 'alle', pending: 'reviews', trash: 'papierkorb' }

export default function AdminRecipes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'alle'
  const initialTab = TAB_MAP[rawTab] || rawTab
  const [tab, setTab] = useState(initialTab)
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [reviewRecipe, setReviewRecipe] = useState(null) // recipe for review modal
  const [reviewComment, setReviewComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchRecipes = useCallback(() => {
    setLoading(true)
    if (tab === 'reviews') {
      client.get('/api/recipes/pending-review')
        .then(res => setRecipes(res.data))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (tab === 'alle') {
      client.get('/api/recipes', { params: { page_size: 50, page: 1 } })
        .then(res => setRecipes(res.data.items))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setRecipes([])
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleDelete = async recipeId => {
    try {
      await client.delete(`/api/recipes/${recipeId}`)
      showToast('Rezept gelöscht')
      fetchRecipes()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Löschen')
    }
    setConfirmDelete(null)
  }

  const handleReview = async (recipeId, approved) => {
    try {
      await client.post(`/api/recipes/${recipeId}/review`, { approved, comment: reviewComment || null })
      showToast(approved ? 'Genehmigt' : 'Abgelehnt')
      setReviewRecipe(null)
      setReviewComment('')
      fetchRecipes()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <Breadcrumb items={[{ label: 'Admin', path: '/admin' }, { label: 'Rezeptverwaltung', path: null }]} />
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 600, margin: '0 0 1.5rem', color: 'var(--text)' }}>
          Rezeptverwaltung
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--card)', borderRadius: 'var(--radius-input)', padding: '0.25rem', width: 'fit-content', boxShadow: 'var(--shadow)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.875rem', background: tab === t.key ? 'var(--accent)' : 'none', color: tab === t.key ? '#fff' : 'var(--subtext)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>Wird geladen …</div>
          ) : tab === 'papierkorb' ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑️</div>
              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif' }}>Funktion in Vorbereitung</p>
            </div>
          ) : recipes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>Keine Rezepte gefunden.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Titel', 'Autor', 'Status', 'Erstellt', 'Aktionen'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipes.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <button onClick={() => navigate(`/recipes/${r.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500, padding: 0, textAlign: 'left' }}>
                          {r.title}
                        </button>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)' }}>{r.author?.name || '—'}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <RecipeStatusBadge status={r.status} reviewStatus={r.review_status} />
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {tab === 'reviews' && (
                            <ActionBtn onClick={() => { setReviewRecipe(r); setReviewComment('') }}>Review</ActionBtn>
                          )}
                          <ActionBtn danger onClick={() => setConfirmDelete(r)}>Löschen</ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {reviewRecipe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem', color: 'var(--text)' }}>
              Review: {reviewRecipe.title}
            </h2>
            <p style={{ color: 'var(--subtext)', fontSize: '0.85rem', margin: '0 0 1.25rem', fontFamily: 'Inter, sans-serif' }}>
              Autor: {reviewRecipe.author?.name || '—'}
            </p>

            <label style={labelStyle}>Kommentar (optional)</label>
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={3}
              placeholder="Feedback für den Autor …"
              style={{ ...inputStyle, resize: 'vertical', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setReviewRecipe(null)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={() => handleReview(reviewRecipe.id, false)} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Ablehnen
              </button>
              <button onClick={() => handleReview(reviewRecipe.id, true)} style={{ padding: '0.6rem 1.25rem', background: '#4A7040', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Genehmigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Rezept „{confirmDelete.title}" wirklich löschen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={() => handleDelete(confirmDelete.id)} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--card)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-pill)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function RecipeStatusBadge({ status, reviewStatus }) {
  if (reviewStatus === 'pending') {
    return <span style={{ background: 'rgba(200,160,32,0.15)', color: '#A68000', borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>In Prüfung</span>
  }
  const colors = {
    published: { bg: 'rgba(107,124,78,0.15)', color: '#4A7040' },
    draft: { bg: 'rgba(107,107,107,0.12)', color: '#6B6B68' },
  }
  const c = colors[status] || colors.draft
  return <span style={{ background: c.bg, color: c.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span>
}

function ActionBtn({ onClick, children, danger }) {
  const [hov, setHov] = useState(false)
  const base = danger
    ? { bg: 'rgba(200,68,68,0.08)', bgHov: 'rgba(200,68,68,0.18)', color: '#C84444', border: '1px solid rgba(200,68,68,0.3)' }
    : { bg: 'rgba(200,96,42,0.08)', bgHov: 'rgba(200,96,42,0.18)', color: 'var(--accent)', border: '1px solid rgba(200,96,42,0.3)' }
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '0.3rem 0.75rem', background: hov ? base.bgHov : base.bg, border: base.border, borderRadius: '6px', color: base.color, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
    >
      {children}
    </button>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.775rem',
  fontWeight: 600,
  color: 'var(--subtext)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.375rem',
  fontFamily: 'Inter, sans-serif',
}

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.875rem',
  border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}
