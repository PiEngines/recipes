// Eine ausklappbare Sammlungs-Zeile — geteilt zwischen Profil-„Gespeichert" und
// der Favoriten-Seite. Chevron/Name klappen die Items inline auf, der „öffnen"-
// Pfeil führt weiter zur Detailseite (Deep-Links bleiben). Geladen wird
// `getCollection(id)` erst beim ersten Aufklappen und danach gecacht — die
// Antwort trägt die gemischten Items (Rezepte + Beiträge) schon abspielfertig,
// ein zweiter Abruf beim Wiederaufklappen entfällt.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCollection } from '../api/collections'
import PostKachel from './PostKachel'
import RecipeCard, { deletedCardProps } from './RecipeCard'

const SICHTBARKEIT_LABEL = {
  private: 'Privat',
  public: 'Öffentlich',
  unlisted: 'Über Link',
}

export default function SammlungAccordion({ collection, onRecipeClick, onPostOpen }) {
  const [offen, setOffen] = useState(false)
  const [items, setItems] = useState(null)   // null = noch nie geladen
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState(false)

  const umschalten = () => {
    const naechster = !offen
    setOffen(naechster)
    if (naechster && items === null && !laden) {
      setLaden(true)
      setFehler(false)
      getCollection(collection.id)
        .then(daten => setItems(daten.items || []))
        .catch(() => setFehler(true))
        .finally(() => setLaden(false))
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem' }}>
        <button
          onClick={umschalten}
          data-track-id="profile-collection-toggle"
          aria-expanded={offen}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <i className={`ti ti-chevron-${offen ? 'down' : 'right'}`} aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {collection.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0 }}>
            {SICHTBARKEIT_LABEL[collection.visibility] || collection.visibility}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {collection.item_count}
          </span>
        </button>
        <Link
          to={`/collections/${collection.id}`}
          data-track-id="profile-collection-open"
          aria-label={`Sammlung „${collection.name}" öffnen`}
          title="Sammlung öffnen"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 'var(--radius-pill)', color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          <i className="ti ti-arrow-up-right" aria-hidden="true" style={{ fontSize: 16 }} />
        </Link>
      </div>

      {offen && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {laden ? (
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton-block" style={{ height: 140, borderRadius: 'var(--radius-card)' }} />
              ))}
            </div>
          ) : fehler ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--danger)' }}>
              Inhalt konnte nicht geladen werden.
            </p>
          ) : (items && items.length === 0) ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Diese Sammlung ist noch leer.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
              {(items || []).map(item => (
                <div key={`${item.item_type}-${item.item_id}`}>
                  {item.item_type === 'recipe' && item.recipe && (
                    <RecipeCard recipe={item.recipe} onClick={() => onRecipeClick(item.recipe.id)} {...(deletedCardProps(item.recipe) || {})} />
                  )}
                  {item.item_type === 'external_post' && item.external_post && (
                    <PostKachel post={item.external_post} onClick={() => onPostOpen(item.external_post)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
