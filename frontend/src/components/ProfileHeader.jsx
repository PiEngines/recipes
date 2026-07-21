/**
 * ProfileHeader — dunkler Profil-Kopf für §13 (eigen) und §15 (öffentlich).
 *
 * Identität + Bio + antippbare Stats. Die Follower-/Folge-ich-Zahlen führen in
 * die Netzwerk-Liste; die Rezept-Zahl kommt aus dem `total` der Rezeptliste,
 * nicht aus dem Profil-Endpoint (der trägt nur die Follow-Zahlen).
 *
 * ABWEICHUNG §13/§15: keine Social-Chips („verbundene Konten") — ohne OAuth
 * gibt es kein Verbinden. Siehe ABWEICHUNGEN.md.
 *
 * `aktion` nimmt den Folgen-Button des öffentlichen Profils auf; das eigene
 * Profil lässt den Slot leer.
 */
import { Link } from 'react-router-dom'

function Stat({ zahl, label, to, trackId }) {
  const inhalt = (
    <>
      <span style={{
        display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700,
        fontSize: 17, lineHeight: 1.1, color: 'var(--on-dark)',
      }}>
        {zahl ?? '–'}
      </span>
      <span style={{
        display: 'block', marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,232,208,.5)',
      }}>
        {label}
      </span>
    </>
  )

  const style = { textAlign: 'center', textDecoration: 'none', minWidth: 62 }

  // Ohne Ziel ist die Zahl reine Anzeige (die Rezept-Zahl führt nirgends hin).
  if (!to) return <div style={style}>{inhalt}</div>

  return (
    <Link to={to} data-track-id={trackId} style={{ ...style, cursor: 'pointer' }}>
      {inhalt}
    </Link>
  )
}

export default function ProfileHeader({ profile, recipeCount, aktion = null, overline = 'Profil' }) {
  const name = profile?.name || 'Profil'
  const initialen = name[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ background: 'var(--ink-braun)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.25rem 1.5rem 1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent)', color: 'var(--on-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-body)', fontSize: 26, fontWeight: 700,
            }}>
              {initialen}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: '0 0 2px', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)',
            }}>
              {overline}
            </p>
            <h1 style={{
              margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
              fontSize: 'clamp(20px, 4vw, 27px)', lineHeight: 1.05, color: 'var(--on-dark)',
            }}>
              {name}
            </h1>
            {profile?.username && (
              <p style={{
                margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'rgba(240,232,208,.55)',
              }}>
                @{profile.username}
              </p>
            )}
          </div>

          {aktion && <div style={{ flexShrink: 0 }}>{aktion}</div>}
        </div>

        {profile?.bio && (
          <p style={{
            margin: '12px 0 0', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5,
            color: 'rgba(240,232,208,.78)', whiteSpace: 'pre-line',
          }}>
            {profile.bio}
          </p>
        )}

        <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
          <Stat zahl={recipeCount} label="Rezepte" />
          <Stat
            zahl={profile?.follower_count}
            label="Follower"
            to={profile ? `/users/${profile.id}/netzwerk?tab=followers` : null}
            trackId="profile-stat-followers"
          />
          <Stat
            zahl={profile?.following_count}
            label="Folge ich"
            to={profile ? `/users/${profile.id}/netzwerk?tab=following` : null}
            trackId="profile-stat-following"
          />
        </div>
      </div>
    </div>
  )
}
