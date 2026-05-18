import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/admin/stats')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.9rem', padding: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ← Zurück zur App
            </button>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
              Admin-Bereich
            </h1>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard label="Benutzer" value={loading ? '…' : stats?.users_count ?? 0} color="var(--accent)" onClick={() => navigate('/admin/users')} />
          <StatCard label="Rezepte" value={loading ? '…' : stats?.recipes_count ?? 0} color="var(--secondary)" onClick={() => navigate('/admin/recipes')} />
          <StatCard label="Ausstehende Registrierungen" value={loading ? '…' : stats?.pending_users ?? 0} color="#C8A020" onClick={() => navigate('/admin/users?tab=pending')} />
          <StatCard label="Ausstehende Reviews" value={loading ? '…' : stats?.pending_reviews ?? 0} color="#8B4513" onClick={() => navigate('/admin/recipes?tab=reviews')} />
        </div>

        {/* Navigation cards */}
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.35rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text)' }}>
          Verwaltung
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          <NavCard
            icon="👥"
            title="Benutzerverwaltung"
            description="Benutzer anzeigen, freischalten, Rollen vergeben und Einladungen versenden."
            onClick={() => navigate('/admin/users')}
          />
          <NavCard
            icon="📖"
            title="Rezeptverwaltung"
            description="Rezepte verwalten, ausstehende Reviews bearbeiten und gelöschte Einträge einsehen."
            onClick={() => navigate('/admin/recipes')}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: 'var(--card)', borderRadius: 'var(--radius-card)', boxShadow: hov ? 'var(--shadow-hover)' : 'var(--shadow)', padding: '1.25rem', textAlign: 'center', cursor: onClick ? 'pointer' : 'default', transition: 'var(--transition)', border: `2px solid ${hov && onClick ? color : 'transparent'}` }}
    >
      <div style={{ fontSize: '2rem', fontWeight: 700, color, fontFamily: 'Inter, sans-serif', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>{label}</div>
    </div>
  )
}

function NavCard({ icon, title, description, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-card)',
        boxShadow: hov ? 'var(--shadow-hover)' : 'var(--shadow)',
        padding: '1.5rem',
        textAlign: 'left',
        border: `2px solid ${hov ? 'var(--accent)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'var(--transition)',
        width: '100%',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--subtext)', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>{description}</div>
    </button>
  )
}
