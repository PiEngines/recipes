import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import Breadcrumb from '../components/Breadcrumb'

const TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'reviews', label: 'Ausstehende Reviews' },
  { key: 'papierkorb', label: 'Papierkorb' },
]

const TAB_MAP = { all: 'alle', pending: 'reviews', trash: 'papierkorb' }

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function AdminRecipes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'alle'
  const initialTab = TAB_MAP[rawTab] || rawTab
  const [tab, setTab] = useState(initialTab)

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [reviewRecipe, setReviewRecipe] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(null)

  // Access management
  const [accessData, setAccessData] = useState({})
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [accessModal, setAccessModal] = useState(null)

  // Filters (reset on tab change)
  const [filterTitle, setFilterTitle] = useState('')
  const [filterAuthorId, setFilterAuthorId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Pagination (pageSize persists across tabs)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchRecipes = useCallback(() => {
    setLoading(true)
    setRecipes([])  // Fix 2: clear stale data immediately
    if (tab === 'reviews') {
      client.get('/api/recipes/pending-review', { params: { page: 1, page_size: 100 } })
        .then(res => setRecipes(res.data))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (tab === 'alle') {
      client.get('/api/recipes', { params: { page_size: 100, page: 1 } })
        .then(res => setRecipes(res.data.items))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (tab === 'papierkorb') {
      client.get('/api/recipes/trash', { params: { page: 1, page_size: 100 } })
        .then(res => setRecipes(res.data))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setRecipes([])
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  // Reset filters + page on tab change
  useEffect(() => {
    setFilterTitle('')
    setFilterAuthorId('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setPage(1)
    setEditingRecipeId(null)
  }, [tab])

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1) }, [filterTitle, filterAuthorId, filterDateFrom, filterDateTo])

  // ── Derived state ─────────────────────────────────────────────────────────

  const authorsList = useMemo(() => {
    const map = new Map()
    recipes.forEach(r => { if (r.author) map.set(r.author.id, r.author.name) })
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    const titleLower = filterTitle.toLowerCase()
    const dateFrom = filterDateFrom ? new Date(filterDateFrom) : null
    const dateTo = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null
    return recipes.filter(r => {
      if (filterTitle && !r.title.toLowerCase().includes(titleLower)) return false
      if (filterAuthorId && String(r.author?.id) !== filterAuthorId) return false
      const created = new Date(r.created_at)
      if (dateFrom && created < dateFrom) return false
      if (dateTo && created > dateTo) return false
      return true
    })
  }, [recipes, filterTitle, filterAuthorId, filterDateFrom, filterDateTo])

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / pageSize))
  const visibleRecipes = filteredRecipes.slice((page - 1) * pageSize, page * pageSize)
  const hasFilter = filterTitle || filterAuthorId || filterDateFrom || filterDateTo

  // ── Handlers ──────────────────────────────────────────────────────────────

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleDelete = async recipeId => {
    try {
      await client.delete(`/api/recipes/${recipeId}`)
      showToast('In den Papierkorb verschoben')
      fetchRecipes()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Löschen')
    }
    setConfirmDelete(null)
  }

  const handleRestore = async recipeId => {
    try {
      await client.post(`/api/recipes/${recipeId}/restore`)
      showToast('Rezept wiederhergestellt')
      fetchRecipes()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Wiederherstellen')
    }
  }

  const handlePermanentDelete = async recipeId => {
    try {
      await client.delete(`/api/recipes/${recipeId}/permanent`)
      showToast('Rezept endgültig gelöscht')
      fetchRecipes()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Löschen')
    }
    setConfirmPermanentDelete(null)
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

  // ── Access management ─────────────────────────────────────────────────────

  const loadAccess = async recipeId => {
    setAccessData(prev => ({ ...prev, [recipeId]: { ...(prev[recipeId] || {}), loading: true } }))
    try {
      const { data } = await client.get(`/api/recipes/${recipeId}/access`, { params: { page: 1, page_size: 50 } })
      setAccessData(prev => ({ ...prev, [recipeId]: { items: data.items || [], loading: false } }))
    } catch {
      setAccessData(prev => ({ ...prev, [recipeId]: { items: [], loading: false } }))
    }
  }

  const enterEditMode = async recipeId => {
    setEditingRecipeId(recipeId)
    await loadAccess(recipeId)
  }

  const handleToggleFreeForAll = async (recipeId, enable, expiresDays) => {
    const current = accessData[recipeId]?.items || []
    const existing = current.find(a => a.access_type === 'free_for_all')
    try {
      if (enable) {
        await client.post(`/api/recipes/${recipeId}/access`, {
          access_type: 'free_for_all',
          expires_days: expiresDays || null,
        })
        showToast('Free for all aktiviert')
      } else if (existing) {
        await client.delete(`/api/recipes/${recipeId}/access/${existing.id}`)
        showToast('Free for all deaktiviert')
      }
      await loadAccess(recipeId)
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setFilterTitle('')
    setFilterAuthorId('')
    setFilterDateFrom('')
    setFilterDateTo('')
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
            <>
              {visibleRecipes.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗑️</div>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Papierkorb ist leer.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Rezeptname', 'Autor', 'Gelöscht am', 'Aktionen'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecipes.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text)', fontWeight: 500 }}>{r.title}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)' }}>{r.author?.name || '—'}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)', whiteSpace: 'nowrap' }}>
                            {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('de-DE') : '—'}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <ActionBtn onClick={() => handleRestore(r.id)}>Wiederherstellen</ActionBtn>
                              <ActionBtn danger onClick={() => setConfirmPermanentDelete(r)}>Endgültig löschen</ActionBtn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {filteredRecipes.length > 0 && (
                <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    Seite {page} von {totalPages} ({filteredRecipes.length} Einträge)
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                      style={{ ...filterInputStyle, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} pro Seite</option>)}
                    </select>
                    <PaginationBtn onClick={() => setPage(1)} disabled={page === 1}>«</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</PaginationBtn>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Filter bar */}
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <input
                  type="text"
                  value={filterTitle}
                  onChange={e => setFilterTitle(e.target.value)}
                  placeholder="Rezeptname …"
                  style={{ ...filterInputStyle, flex: '1 1 160px' }}
                />
                <select
                  value={filterAuthorId}
                  onChange={e => setFilterAuthorId(e.target.value)}
                  style={{ ...filterInputStyle, flex: '0 1 160px' }}
                >
                  <option value="">Alle Autoren</option>
                  {authorsList.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...filterInputStyle, flex: '0 1 140px' }} title="Von Datum" />
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...filterInputStyle, flex: '0 1 140px' }} title="Bis Datum" />
                {hasFilter && (
                  <button onClick={resetFilters} style={{ padding: '0.45rem 0.875rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Zurücksetzen
                  </button>
                )}
              </div>

              {visibleRecipes.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>
                  {hasFilter ? 'Keine Rezepte entsprechen den Filterkriterien.' : 'Keine Rezepte gefunden.'}
                </div>
              ) : tab === 'reviews' ? (
                /* ── Reviews tab: table layout ── */
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
                      {visibleRecipes.map(r => (
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
                              <ActionBtn onClick={() => { setReviewRecipe(r); setReviewComment('') }}>Review</ActionBtn>
                              <ActionBtn danger onClick={() => setConfirmDelete(r)}>Löschen</ActionBtn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── Alle tab: list layout with access management ── */
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {visibleRecipes.map(r => {
                    const access = accessData[r.id]
                    const freeEntry = access?.items?.find(a => a.access_type === 'free_for_all')
                    const individualCount = access?.items?.filter(a => a.access_type === 'individual').length ?? 0
                    const isFree = !!freeEntry
                    const isEditing = editingRecipeId === r.id

                    return (
                      <div key={r.id} style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                        {/* Recipe row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => navigate(`/recipes/${r.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 500, padding: 0, textAlign: 'left' }}>
                              {r.title}
                            </button>
                            {r.author?.name && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>
                                von {r.author.name}
                              </span>
                            )}
                            <RecipeStatusBadge status={r.status} reviewStatus={r.review_status} />
                            {isFree && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(107,124,78,0.15)', color: '#4A7040', borderRadius: '5px', padding: '0.15rem 0.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                                🌍 Öffentlich
                              </span>
                            )}
                            {!isFree && individualCount > 0 && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(200,96,42,0.1)', color: 'var(--accent)', borderRadius: '5px', padding: '0.15rem 0.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                                {individualCount} Freigabe{individualCount !== 1 ? 'n' : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                            {!isEditing ? (
                              <ActionBtn onClick={() => enterEditMode(r.id)}>Freigaben bearbeiten</ActionBtn>
                            ) : (
                              <ActionBtn onClick={() => setEditingRecipeId(null)}>Fertig</ActionBtn>
                            )}
                            <ActionBtn danger onClick={() => setConfirmDelete(r)}>Löschen</ActionBtn>
                          </div>
                        </div>

                        {/* Edit panel — only in edit mode */}
                        {isEditing && (
                          <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                            {/* Fix 5: Compact recipe info line */}
                            <div style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {r.author?.name && <span>Autor: <strong style={{ color: 'var(--text)' }}>{r.author.name}</strong></span>}
                              <span>Erstellt: {new Date(r.created_at).toLocaleDateString('de-DE')}</span>
                              {r.updated_at && r.updated_at !== r.created_at && (
                                <span>Geändert: {new Date(r.updated_at).toLocaleDateString('de-DE')}</span>
                              )}
                            </div>
                            {/* Access controls */}
                            <div style={{ padding: '0.625rem 1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {access?.loading ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif' }}>Wird geladen …</span>
                              ) : (
                                <>
                                  <FreeForAllToggle
                                    recipeId={r.id}
                                    isActive={isFree}
                                    currentEntry={freeEntry}
                                    onToggle={handleToggleFreeForAll}
                                  />
                                  <button
                                    onClick={() => setAccessModal({ recipeId: r.id, title: r.title })}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 500 }}
                                  >
                                    Einzelfreigaben
                                    {individualCount > 0 && (
                                      <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>
                                        {individualCount}
                                      </span>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pagination bar */}
              {filteredRecipes.length > 0 && (
                <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    Seite {page} von {totalPages} ({filteredRecipes.length} Einträge)
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                      style={{ ...filterInputStyle, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} pro Seite</option>)}
                    </select>
                    <PaginationBtn onClick={() => setPage(1)} disabled={page === 1}>«</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</PaginationBtn>
                    <PaginationBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</PaginationBtn>
                  </div>
                </div>
              )}
            </>
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

      {/* Confirm permanent delete */}
      {confirmPermanentDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 0.5rem', lineHeight: 1.5, fontWeight: 600 }}>
              Rezept endgültig löschen?
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--subtext)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              „{confirmPermanentDelete.title}" wird unwiderruflich gelöscht – inklusive aller Medien.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmPermanentDelete(null)} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
                Abbrechen
              </button>
              <button onClick={() => handlePermanentDelete(confirmPermanentDelete.id)} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Endgültig löschen
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
              Rezept „{confirmDelete.title}" in den Papierkorb verschieben?
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

      {/* Individual access modal */}
      {accessModal && (
        <IndividualAccessModal
          recipeId={accessModal.recipeId}
          title={accessModal.title}
          items={(accessData[accessModal.recipeId]?.items || []).filter(a => a.access_type === 'individual')}
          onClose={() => setAccessModal(null)}
          onRefresh={() => loadAccess(accessModal.recipeId)}
          onToast={showToast}
        />
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

// ── Sub-components ────────────────────────────────────────────────────────────

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

function PaginationBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ padding: '0.3rem 0.625rem', border: '1.5px solid var(--border-input)', borderRadius: '6px', background: disabled ? 'none' : 'var(--bg)', color: disabled ? 'var(--border-input)' : 'var(--text)', cursor: disabled ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', lineHeight: 1, minWidth: '28px' }}
    >
      {children}
    </button>
  )
}

// ── Free-for-all toggle (mirrored from Profile.jsx) ───────────────────────────

function FreeForAllToggle({ recipeId, isActive, currentEntry, onToggle }) {
  const [saving, setSaving] = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [noLimit, setNoLimit] = useState(true)

  const handleChange = async checked => {
    if (checked && !noLimit && !expiryDate) { setShowExpiry(true); return }
    setSaving(true)
    let expiresDays = null
    if (checked && !noLimit && expiryDate) {
      const diffMs = new Date(expiryDate) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    await onToggle(recipeId, checked, expiresDays)
    setSaving(false)
    setShowExpiry(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text)' }}>
        <input type="checkbox" checked={isActive} disabled={saving} onChange={e => handleChange(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
        🌍 Free for all
        {isActive && currentEntry?.expires_at && (
          <span style={{ color: 'var(--subtext)', fontWeight: 400 }}>· bis {new Date(currentEntry.expires_at).toLocaleDateString('de-DE')}</span>
        )}
      </label>
      {isActive && (
        <button onClick={() => handleChange(false)} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
          Deaktivieren
        </button>
      )}
      {!isActive && showExpiry && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--subtext)', cursor: 'pointer' }}>
            <input type="checkbox" checked={noLimit} onChange={e => setNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Ohne Limit
          </label>
          {!noLimit && (
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
              style={{ ...inputStyle, width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} />
          )}
          <button onClick={() => handleChange(true)} disabled={saving || (!noLimit && !expiryDate)}
            style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            {saving ? '…' : 'Aktivieren'}
          </button>
          <button onClick={() => setShowExpiry(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.78rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
            Abbrechen
          </button>
        </div>
      )}
      {!isActive && !showExpiry && (
        <button onClick={() => setShowExpiry(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.75rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
          Aktivieren …
        </button>
      )}
    </div>
  )
}

// ── Individual access modal (mirrored from Profile.jsx) ───────────────────────

function IndividualAccessModal({ recipeId, title, items, onClose, onRefresh, onToast }) {
  const [newEmail, setNewEmail] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [newNoLimit, setNewNoLimit] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async e => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setAdding(true)
    setError('')
    let expiresDays = null
    if (!newNoLimit && newExpiry) {
      const diffMs = new Date(newExpiry) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    try {
      await client.post(`/api/recipes/${recipeId}/access`, {
        access_type: 'individual', email: newEmail.trim(), expires_days: expiresDays,
      })
      const limitLabel = newNoLimit ? 'Ohne Limit' : newExpiry ? new Date(newExpiry).toLocaleDateString('de-DE') : 'Ohne Limit'
      onToast?.(`Mit ${newEmail.trim()} geteilt. Limit: ${limitLabel}`)
      setNewEmail(''); setNewExpiry(''); setNewNoLimit(true)
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Hinzufügen.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async accessId => {
    try { await client.delete(`/api/recipes/${recipeId}/access/${accessId}`); onRefresh() } catch {}
  }

  const handleUpdateExpiry = async (accessId, expiresDays, ohneLimit) => {
    try {
      await client.patch(`/api/recipes/${recipeId}/access/${accessId}`, { expires_days: ohneLimit ? null : expiresDays, ohne_limit: ohneLimit })
      onRefresh()
    } catch {}
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '1.75rem', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
            Einzelfreigaben – {title}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '1.25rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {items.length === 0 ? (
          <p style={{ color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>Keine Einzelfreigaben.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {items.map(a => <AccessEntryRow key={a.id} entry={a} onRemove={() => handleRemove(a.id)} onUpdate={handleUpdateExpiry} />)}
          </div>
        )}
        <form onSubmit={handleAdd} style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
            Hinzufügen
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email-Adresse" required style={{ ...inputStyle }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={newNoLimit} onChange={e => setNewNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Ohne Limit
              </label>
              {!newNoLimit && (
                <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ ...inputStyle, width: 'auto', flex: 1 }} />
              )}
            </div>
            {error && <p style={{ color: '#C84444', fontFamily: 'Inter, sans-serif', fontSize: '0.825rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={adding} style={{ padding: '0.6rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: adding ? 0.7 : 1 }}>
              {adding ? 'Wird hinzugefügt …' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AccessEntryRow({ entry, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [expiryDate, setExpiryDate] = useState(entry.expires_at ? new Date(entry.expires_at).toISOString().split('T')[0] : '')
  const [noLimit, setNoLimit] = useState(!entry.expires_at)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    let expiresDays = null
    if (!noLimit && expiryDate) {
      const diffMs = new Date(expiryDate) - new Date()
      expiresDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }
    await onUpdate(entry.id, expiresDays, noLimit)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '0.625rem 0.75rem', background: 'var(--bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.email}</span>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button onClick={() => setEditing(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtext)', fontSize: '0.8rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>
            {editing ? 'Abbrechen' : entry.expires_at ? new Date(entry.expires_at).toLocaleDateString('de-DE') : 'Ohne Limit'}
          </button>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C84444', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={noLimit} onChange={e => setNoLimit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Ohne Limit
          </label>
          {!noLimit && (
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
              style={{ ...inputStyle, width: 'auto', flex: 1, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} />
          )}
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.2rem 0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--subtext)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem', fontFamily: 'Inter, sans-serif',
}

const inputStyle = {
  width: '100%', padding: '0.6rem 0.875rem', border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)', background: 'var(--bg)', color: 'var(--text)',
  fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}

const filterInputStyle = {
  padding: '0.45rem 0.75rem', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
  outline: 'none', boxSizing: 'border-box',
}
