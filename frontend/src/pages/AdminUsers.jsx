import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getRoleLabel } from '../utils/roles'
import Breadcrumb from '../components/Breadcrumb'

const TABS = [
  { key: 'active', label: 'Aktiv' },
  { key: 'pending', label: 'Ausstehend' },
  { key: 'deleted', label: 'Gelöscht' },
]

const ROLES = ['kuechenhilfe', 'koch', 'chefkoch', 'kuechenchef']
const ACTIVATION_ROLES_KUECHENCHEF = ['kuechenhilfe', 'koch', 'chefkoch', 'kuechenchef']
const ACTIVATION_ROLES_CHEFKOCH = ['kuechenhilfe', 'koch', 'chefkoch']

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const isKuechenchef = currentUser?.role === 'kuechenchef' || currentUser?.role === 'admin'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'active'
  const [tab, setTab] = useState(initialTab)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null) // { userId, action, name }
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activatedIds, setActivatedIds] = useState(() => new Set())
  const [activateRoles, setActivateRoles] = useState({})

  const activationRoles = isKuechenchef ? ACTIVATION_ROLES_KUECHENCHEF : ACTIVATION_ROLES_CHEFKOCH

  // Invitation state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('kuechenhilfe')
  const [inviting, setInviting] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    client.get('/api/users', { params: { status: tab } })
      .then(res => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleInvite = async e => {
    e.preventDefault()
    setInviting(true)
    try {
      await client.post('/api/auth/invite', { email: inviteEmail, role: inviteRole })
      showToast('Einladung gesendet')
      setInviteEmail('')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler beim Einladen')
    } finally {
      setInviting(false)
    }
  }

  const handleActivate = async userId => {
    const role = activateRoles[userId] || 'kuechenhilfe'
    try {
      await client.patch(`/api/users/${userId}/activate`, { role })
      showToast('Benutzer freigeschaltet')
      setActivatedIds(prev => new Set(prev).add(userId))
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
    }
  }

  const handleDelete = async userId => {
    try {
      await client.delete(`/api/users/${userId}`)
      showToast('Benutzer gelöscht')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
    }
    setConfirmDialog(null)
  }

  const handleRestore = async userId => {
    try {
      await client.post(`/api/users/${userId}/restore`)
      showToast('Benutzer wiederhergestellt')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
    }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      await client.patch(`/api/users/${userId}/role`, { role })
      showToast('Rolle aktualisiert')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
    }
  }

  const handleUsernameChange = async (userId, username) => {
    try {
      await client.patch(`/api/users/${userId}/username`, { username })
      showToast('Username aktualisiert')
      fetchUsers()
      return true
    } catch (err) {
      showToast(err.response?.data?.detail || 'Fehler')
      return false
    }
  }

  const q = search.toLowerCase()
  const filteredUsers = users.filter(u => {
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const created = new Date(u.created_at)
    const matchesFrom = !dateFrom || created >= new Date(dateFrom)
    const matchesTo = !dateTo || created <= new Date(dateTo + 'T23:59:59')
    return matchesSearch && matchesFrom && matchesTo
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <Breadcrumb items={[{ label: 'Admin', path: '/admin' }, { label: 'Benutzerverwaltung', path: null }]} />
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 600, margin: '0 0 1.5rem', color: 'var(--text)' }}>
          Benutzerverwaltung
        </h1>

        {/* Invite section */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text)' }}>Benutzer einladen</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>E-Mail-Adresse</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                placeholder="email@beispiel.de"
                style={inputStyle}
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <label style={labelStyle}>Rolle</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={inputStyle}>
                <option value="kuechenhilfe">Küchenhilfe</option>
                <option value="koch">Koch</option>
                <option value="chefkoch">Chefkoch</option>
                <option value="kuechenchef">Küchenchef</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              style={{ padding: '0.6rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-input)', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: inviting ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: inviting ? 0.7 : 1 }}
            >
              {inviting ? '…' : 'Einladen'}
            </button>
          </form>
        </div>

        {/* Search + date filter */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={labelStyle}>Suche</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name oder E-Mail"
              style={inputStyle}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <label style={labelStyle}>Beigetreten von</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ minWidth: '140px' }}>
            <label style={labelStyle}>bis</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
          </div>
          {(search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
              style={{ padding: '0.6rem 1rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Zurücksetzen
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--card)', borderRadius: 'var(--radius-input)', padding: '0.25rem', width: 'fit-content', boxShadow: 'var(--shadow)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.875rem', background: tab === t.key ? 'var(--accent)' : 'none', color: tab === t.key ? '#fff' : 'var(--subtext)', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* User list */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>Wird geladen …</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--subtext)' }}>Keine Benutzer gefunden.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'E-Mail', 'Username', 'Rolle', 'Status', 'Beigetreten', 'Aktionen'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text)', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)' }}>{u.email}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {isKuechenchef ? (
                          <UsernameCell username={u.username} onSave={username => handleUsernameChange(u.id, username)} />
                        ) : (
                          <span style={{ color: 'var(--subtext)' }}>{u.username || '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {tab === 'active' ? (
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--subtext)' }}>{getRoleLabel(u.role)}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {tab === 'pending' && activatedIds.has(u.id) ? (
                          <span style={{ color: '#4A7040', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                            Freigeschaltet – wartet auf Email-Bestätigung
                          </span>
                        ) : (
                          <StatusBadge status={u.status} />
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--subtext)', whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {tab === 'active' && (
                            <ActionBtn danger onClick={() => setConfirmDialog({ userId: u.id, action: 'delete', name: u.name })}>
                              Löschen
                            </ActionBtn>
                          )}
                          {tab === 'pending' && !activatedIds.has(u.id) && (
                            <>
                              <select
                                value={activateRoles[u.id] || 'kuechenhilfe'}
                                onChange={e => setActivateRoles(prev => ({ ...prev, [u.id]: e.target.value }))}
                                style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                              >
                                {activationRoles.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                              </select>
                              <ActionBtn onClick={() => handleActivate(u.id)}>Freischalten</ActionBtn>
                              <ActionBtn danger onClick={() => setConfirmDialog({ userId: u.id, action: 'delete', name: u.name })}>Ablehnen</ActionBtn>
                            </>
                          )}
                          {tab === 'deleted' && (
                            <ActionBtn onClick={() => handleRestore(u.id)}>Wiederherstellen</ActionBtn>
                          )}
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

      {/* Confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={`${confirmDialog.action === 'delete' ? 'Benutzer' : ''} "${confirmDialog.name}" wirklich ${confirmDialog.action === 'delete' ? 'löschen' : 'fortfahren'}?`}
          onConfirm={() => {
            if (confirmDialog.action === 'delete') handleDelete(confirmDialog.userId)
          }}
          onCancel={() => setConfirmDialog(null)}
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

function UsernameCell({ username, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(username || '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(username || ''); setEditing(true) }}
        style={{ background: 'none', border: 'none', padding: 0, color: username ? 'var(--text)' : 'var(--subtext)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
        title="Username bearbeiten"
      >
        {username || '— bearbeiten'}
      </button>
    )
  }

  const commit = async () => {
    const trimmed = value.trim()
    if (trimmed === (username || '') || !trimmed) { setEditing(false); return }
    setSaving(true)
    const ok = await onSave(trimmed)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <input
      type="text"
      value={value}
      autoFocus
      disabled={saving}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { setValue(username || ''); setEditing(false) }
      }}
      style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.8rem', maxWidth: '160px' }}
    />
  )
}

function StatusBadge({ status }) {
  const colors = {
    active: { bg: 'rgba(107,124,78,0.15)', color: '#4A7040' },
    pending: { bg: 'rgba(200,160,32,0.15)', color: '#A68000' },
    deleted: { bg: 'rgba(200,68,68,0.12)', color: '#C84444' },
  }
  const c = colors[status] || colors.active
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
      {status}
    </span>
  )
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

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', padding: '2rem', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', background: 'none', border: '1.5px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--subtext)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', fontSize: '0.875rem' }}>
            Abbrechen
          </button>
          <button onClick={onConfirm} style={{ padding: '0.6rem 1.25rem', background: '#C84444', border: 'none', borderRadius: 'var(--radius-input)', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
            Bestätigen
          </button>
        </div>
      </div>
    </div>
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
