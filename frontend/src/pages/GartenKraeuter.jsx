// Garten & Kräuter — schlanke Übersicht (IA-Umbau · Commit 3)
// Ein Menüpunkt fasst die beiden bestehenden Bereiche zusammen; hier landen
// heißt: einen Tap tief zu /garten (Mein Beet) oder /kraeuterschule (Wissen).
// Bewusst kein Eigenbau — grüne Farbwelt + vorhandene Card-Optik.

import { Link } from 'react-router-dom'

// Zwei Einstiege → bestehende Zielseiten. Icon aus der Tabler-Schrift, wie in
// der BottomNav (ti-seeding = Garten, ti-plant-2 = Kräuter).
const EINSTIEGE = [
  {
    to: '/garten',
    icon: 'ti-seeding',
    titel: 'Mein Garten',
    teaser: 'Dein Beet — was du anbaust, gerade wächst und ernten kannst.',
    trackId: 'garten-kraeuter-garten-click',
  },
  {
    to: '/kraeuterschule',
    icon: 'ti-plant-2',
    titel: 'Kräuterschule',
    teaser: 'Pflanzenwissen, Saison-Kalender und das Kraut des Monats.',
    trackId: 'garten-kraeuter-kraeuterschule-click',
  },
]

export default function GartenKraeuter() {
  return (
    <div data-world="gruen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 6rem' }}>

        {/* Kopf */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Grünes
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 4vw, 30px)', lineHeight: 1, color: 'var(--text)' }}>
            Garten &amp; Kräuter
          </h1>
        </div>

        {/* Zwei Einstiege */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EINSTIEGE.map(({ to, icon, titel, teaser, trackId }) => (
            <Link
              key={to}
              to={to}
              data-track-id={trackId}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--surface)', borderRadius: 'var(--radius-card)',
                boxShadow: '0 2px 0 var(--wood-shadow), 0 1px 4px rgba(0,0,0,.06)',
                padding: '16px 18px', textDecoration: 'none', color: 'inherit',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none', width: 46, height: 46, borderRadius: 'var(--radius-tag)',
                  background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i className={`ti ${icon}`} style={{ fontSize: 24, color: 'var(--green)' }} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 18, lineHeight: 1.1, color: 'var(--text)' }}>
                  {titel}
                </span>
                <span style={{ display: 'block', margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, color: 'var(--text-muted)' }}>
                  {teaser}
                </span>
              </span>
              <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 20, color: 'var(--text-muted)', flex: 'none' }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
