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
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PostKachel from './PostKachel'
import PostOverlay from './PostOverlay'

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

// Freigegebene Ernährungs-Blöcke als Chip-Reihe im Kopf.
function TaxRow({ label, items }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{
        margin: '0 0 5px', fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(t => (
          <span key={t.id} style={{
            padding: '3px 10px', borderRadius: 999,
            background: 'rgba(240,232,208,.10)', border: '1px solid rgba(240,232,208,.18)',
            fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(240,232,208,.85)',
          }}>
            {t.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// Ein angepinntes Rezept als kompakte Kachel (Foto + Titel) — dunkler Kopf,
// daher eigenes Tile statt der hellen RecipeCard.
function PinnedRecipe({ recipe }) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      data-track-id="profile-highlight-recipe"
      style={{ minWidth: 0, textDecoration: 'none' }}
    >
      <div style={{
        width: '100%', aspectRatio: '116 / 84', borderRadius: 10, overflow: 'hidden',
        background: recipe.primary_image ? `center/cover no-repeat url(${recipe.primary_image})` : 'rgba(240,232,208,.10)',
      }} />
      <div style={{
        marginTop: 5, fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.25,
        color: 'rgba(240,232,208,.85)', overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {recipe.title}
      </div>
    </Link>
  )
}

// Highlights-Streifen im Kopf: bis zu drei Rezepte + drei Beiträge. Erscheint
// bei eigenem und fremdem Profil, sobald etwas angepinnt ist. `onEdit` (nur
// eigenes Profil) blendet die Bearbeiten-Affordanz ein; ohne Pins wird sie zum
// dezenten Einstieg.
function Highlights({ pinned, onEdit }) {
  const [offenerPost, setOffenerPost] = useState(null)
  const recipes = pinned?.recipes || []
  const posts = pinned?.posts || []
  const leer = recipes.length === 0 && posts.length === 0

  if (leer && !onEdit) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{
          margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)',
        }}>
          Highlights
        </p>
        {onEdit && (
          <button
            onClick={onEdit}
            data-track-id="profile-highlight-edit"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'rgba(240,232,208,.7)' }}
          >
            {leer ? 'Highlights hinzufügen' : 'Bearbeiten'}
          </button>
        )}
      </div>

      {!leer && (
        // 2×3-Raster: bis zu 6 Pins (3 Rezepte + 3 Beiträge) brechen in zwei
        // Reihen à 3 um — kein Seitwärts-Scrollen mehr. `maxWidth` hält die
        // Kacheln auch bei ein, zwei Pins in Kachelgröße statt spaltenbreit.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8, maxWidth: 380 }}>
          {recipes.map(r => <PinnedRecipe key={`r-${r.id}`} recipe={r} />)}
          {posts.map(p => (
            <div key={`p-${p.id}`} style={{ minWidth: 0 }}>
              <PostKachel post={p} onClick={() => setOffenerPost(p)} />
            </div>
          ))}
        </div>
      )}

      {offenerPost && <PostOverlay post={offenerPost} onClose={() => setOffenerPost(null)} />}
    </div>
  )
}

export default function ProfileHeader({ profile, recipeCount, aktion = null, overline = 'Profil', onEditPins = null }) {
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

        {/* „Über deine Küche" (BUG-41) — nur sichtbar, wenn freigegeben: der
            Endpoint liefert `preferences` sonst gar nicht erst (die Gate-Logik
            sitzt serverseitig, hier steht dann schlicht nichts). */}
        {profile?.preferences && (
          <div style={{ marginTop: 12 }}>
            <p style={{
              margin: '0 0 3px', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,232,208,.45)',
            }}>
              Über meine Küche
            </p>
            <p style={{
              margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5,
              color: 'rgba(240,232,208,.78)', whiteSpace: 'pre-line',
            }}>
              {profile.preferences}
            </p>
          </div>
        )}

        {/* Ernährungsprofil (Ü18) — nur die freigegebenen Blöcke; der Endpoint
            liefert sie sonst leer. Allergien tauchen hier nie auf. */}
        <TaxRow label="Ernährungsweise" items={profile?.diet_labels} />
        <TaxRow label="Ausschlüsse" items={profile?.exclusions} />

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

        {/* Highlights (Ü18) — angepinnte Rezepte + Beiträge, nach der
            Stats-Reihe. `onEditPins` nur beim eigenen Profil. */}
        <Highlights pinned={profile?.pinned} onEdit={onEditPins} />
      </div>
    </div>
  )
}
