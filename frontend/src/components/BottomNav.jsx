import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isKochOrAbove } from '../utils/roles'

// Bottom-Nav Wahl 2.0 (SPEC §2.7): 5 Slots — Home · Rezepte · Neu (zentraler
// erhöhter +) · Favoriten · Mehr. Höhe 78px, Creme-Fläche mit Holz-Oberkante.
// Aktiv = dunkles Ink-Icon+Label (var(--text)), inaktiv = var(--nav-muted).
// (Prototyp screens/*.html rendern den aktiven Slot bewusst dunkel, nicht Terrakotta.)
// Profil liegt unter »Mehr« — KEIN eigener Slot.

const ICON = 22

export default function BottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const canCreate = isKochOrAbove(user)
  const [moreOpen, setMoreOpen] = useState(false)

  // Aktiver-Tab-Logik (SPEC §2.7): eigener Bereich → Slot aktiv;
  // hineingesprungene Unterseiten (fremdes Profil) → Footer neutral;
  // Mehr-Panel-Ziele → »Mehr« aktiv.
  const startsWith = (p) => pathname === p || pathname.startsWith(p + '/')
  const isNeu = pathname === '/recipes/new'
  const isHome = pathname === '/'
  const isRezepte = startsWith('/recipes') && !isNeu
  const isFavoriten = startsWith('/favorites')
  // Alles, was im Mehr-Panel hängt, hält den Mehr-Slot aktiv — Garten hat
  // seit BUG-04 keinen eigenen Slot mehr, Kräuterschule und Pflanzen-Detail
  // gehören zur selben Welt. Profil, Saison und Beiträge stehen im
  // Avatar-Menü bzw. sind kein Panel-Ziel mehr.
  const MEHR_PATHS = ['/categories', '/fratcher', '/einkaufsliste', '/kraeuterschule', '/garten', '/pflanzen', '/einstellungen', '/profile']
  const isMehr = moreOpen || MEHR_PATHS.some(startsWith)

  const slotStyle = (active) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    padding: '2px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    color: active ? 'var(--text)' : 'var(--nav-muted)',
  })

  const labelStyle = (active) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: active ? 600 : 400,
    letterSpacing: '.04em',
    color: active ? 'var(--text)' : 'var(--nav-muted)',
  })

  // Genau fünf — eine gleichmäßige Reihe zu je 20%. Einstellungen sind seit
  // Ü19 nur noch übers Avatar-Menü erreichbar (raus aus dem Panel).
  const MEHR_ITEMS = [
    { icon: 'ti-plant-2', label: 'Kräuterschule', to: '/kraeuterschule', trackId: 'bottom-mehr-kraeuterschule-click' },
    { icon: 'ti-basket', label: 'Einkaufsliste', to: '/einkaufsliste', trackId: 'bottom-mehr-einkaufsliste-click' },
    { icon: 'ti-category', label: 'Kategorien', to: '/categories', trackId: 'bottom-mehr-kategorien-click' },
    { icon: 'ti-fridge', label: 'Kühlschrank', to: '/fratcher', trackId: 'bottom-mehr-fratcher-click' },
    { icon: 'ti-seeding', label: 'Garten', to: '/garten', trackId: 'bottom-mehr-garten-click' },
  ]

  const mehrItemStyle = (dimmed) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 0',
    color: 'var(--nav-muted)',
    textDecoration: 'none',
    opacity: dimmed ? 0.4 : 1,
    cursor: dimmed ? 'default' : 'pointer',
    fontFamily: 'var(--font-mono)',
  })

  return (
    <>
      {/* Backdrop zum Schließen des »Mehr«-Panels.
          Die drei Ebenen (Backdrop 102 < Panel 103 < Leiste 104) liegen
          bewusst über dem fixierten CTA aus `ZurListe` (z 101) — der lag
          sonst über dem aufklappenden Panel (BUG-55). Untereinander bleibt
          die Ordnung wie gehabt: die Leiste zuoberst, damit die Slots auch
          bei offenem Panel antippbar sind. */}
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 102 }} />
      )}

      {/* »Mehr«-Slide-up-Panel.
          Bewusst ohne `.bottom-nav`: die Klasse setzt ab 768px `display:none`.
          Die Hauptleiste überschreibt das mit ihrem Inline-`display:flex` und
          bleibt am Desktop sichtbar — das Panel hatte kein Inline-`display`
          und war deshalb dort unsichtbar, der »Mehr«-Tap wirkungslos. */}
      <div
        style={{
          position: 'fixed',
          bottom: 78,
          left: 0,
          right: 0,
          zIndex: 103,
          background: 'var(--surface)',
          borderTop: '2px solid var(--nav-top)',
          padding: '6px 0 10px',
          transform: moreOpen ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform .22s ease',
          boxShadow: '0 -4px 20px rgba(0,0,0,.10)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: 480, margin: '0 auto' }}>
          {MEHR_ITEMS.map(({ icon, label, to, trackId }) => {
            const inner = (
              <>
                <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.02em' }}>
                  {label}{!to && ' · bald'}
                </span>
              </>
            )
            return to ? (
              <Link
                key={label}
                to={to}
                onClick={() => setMoreOpen(false)}
                data-track-id={trackId}
                style={{ ...mehrItemStyle(false), flexBasis: '20%' }}
              >
                {inner}
              </Link>
            ) : (
              <span
                key={label}
                data-track-id={trackId}
                aria-disabled="true"
                style={{ ...mehrItemStyle(true), flexBasis: '20%' }}
              >
                {inner}
              </span>
            )
          })}
        </div>
      </div>

      {/* Haupt-Leiste */}
      <nav
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 78,
          background: 'var(--bg)',
          borderTop: '2px solid var(--nav-top)',
          boxShadow: '0 -2px 0 var(--nav-top-shadow)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '10px 4px 0',
          zIndex: 104,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', width: '100%', maxWidth: 480 }}>
          <Link to="/" data-track-id="bottom-nav-home-click" style={slotStyle(isHome)}>
            <i className="ti ti-home" style={{ fontSize: ICON }} />
            <span style={labelStyle(isHome)}>Home</span>
          </Link>

          <Link to="/recipes" data-track-id="bottom-nav-rezepte-click" style={slotStyle(isRezepte)}>
            <i className="ti ti-book-2" style={{ fontSize: ICON }} />
            <span style={labelStyle(isRezepte)}>Rezepte</span>
          </Link>

          {/* Neu — zentraler erhöhter + (44×44, dunkel, −16px) */}
          {canCreate ? (
            <Link to="/recipes/new" data-track-id="bottom-nav-neu-click" style={{ ...slotStyle(isNeu), gap: 2 }}>
              <span style={{ width: 44, height: 44, borderRadius: 6, marginTop: -16, background: 'var(--ink-braun)', boxShadow: 'var(--nav-fab-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: 24, color: 'var(--on-accent)' }} />
              </span>
              <span style={labelStyle(isNeu)}>Neu</span>
            </Link>
          ) : (
            <span data-track-id="bottom-nav-neu-click" style={{ ...slotStyle(false), gap: 2, opacity: 0.4, cursor: 'default' }}>
              <span style={{ width: 44, height: 44, borderRadius: 6, marginTop: -16, background: 'var(--ink-braun)', boxShadow: 'var(--nav-fab-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: 24, color: 'var(--on-accent)' }} />
              </span>
              <span style={labelStyle(false)}>Neu</span>
            </span>
          )}

          <Link to="/favorites" data-track-id="bottom-nav-favoriten-click" style={slotStyle(isFavoriten)}>
            <i className="ti ti-heart" style={{ fontSize: ICON }} />
            <span style={labelStyle(isFavoriten)}>Favoriten</span>
          </Link>

          <button onClick={() => setMoreOpen(m => !m)} data-track-id="bottom-nav-mehr-click" style={slotStyle(isMehr)}>
            <i className="ti ti-dots" style={{ fontSize: ICON }} />
            <span style={labelStyle(isMehr)}>Mehr</span>
          </button>
        </div>
      </nav>
    </>
  )
}
