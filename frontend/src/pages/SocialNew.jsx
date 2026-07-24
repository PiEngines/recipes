// Beitrag erstellen — reiner Erstellen-Screen (IA-Umbau · Commit 6)
// „+ → Beitrag erstellen" führt hierher: nur das Formular, keine Reel-Liste.
// Kein Eigenbau — die vorhandene AddPostForm aus Social.jsx, ausgeklappt.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddPostForm } from './Social'

export default function SocialNew() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Beitrag erstellen – PiEngines Recipes'
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Kopf wie /social, aber als Erstellen-Screen betitelt */}
      <div style={{ background: 'var(--ink-braun)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 1rem' }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)' }}>
            Social
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(21px, 4vw, 28px)', lineHeight: 1, color: 'var(--on-dark)' }}>
            Beitrag erstellen
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.25rem 6rem' }}>
        {/* Nach dem Speichern zur Beitrags-Liste, wo der neue Beitrag steht. */}
        <AddPostForm
          startOpen
          onCancel={() => navigate(-1)}
          onSaved={() => navigate('/social')}
        />
      </div>
    </div>
  )
}
