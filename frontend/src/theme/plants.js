// Gemeinsame Bausteine der Kräuterschule (U1 Übersicht + U2 Detail).

/* Foto-Platzhalter für ALLE Pflanzenbilder (SPEC §1.7).
 *
 * Es gibt keine echten Pflanzenbilder — `bild_dateiname` wird bewusst ignoriert,
 * bis echte Assets vorliegen. Dann reicht ein Tausch an dieser Stelle.
 *
 * Bewusst *kein* Bild-Asset und kein bunter Verlauf, sondern das diagonale
 * Streifenmuster aus §1.7: es liest sich als „hier kommt ein Foto rein" und
 * nicht als gestaltete Fläche. */
const STREIFEN = 'repeating-linear-gradient(45deg, #c8bda4, #c8bda4 8px, #bfb397 8px, #bfb397 16px)'

// ◭ als Inline-SVG statt als Textglyph: so hängt die Darstellung nicht an einer
// Schriftart, die das Zeichen kennen muss.
const GLYPH = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4 L21 20 H3 Z' fill='none' stroke='%23a2977c' stroke-width='1.6' stroke-linejoin='round'/%3E%3Cpath d='M12 4 L12 20 H3 Z' fill='%23a2977c'/%3E%3C/svg%3E\")"

/** Bild-Fläche mit Platzhalter — Streifenmuster, für Kacheln und Zeilen. */
export const plantImageStyle = {
  backgroundImage: STREIFEN,
  backgroundColor: '#c8bda4',
}

/** Wie `plantImageStyle`, zusätzlich mit ◭ in der Mitte.
 *  Nur für große Flächen (Hero, Spotlight) — auf 38px-Zeilen wäre der Glyph
 *  bloß Rauschen. */
export const plantHeroImageStyle = {
  backgroundImage: `${GLYPH}, ${STREIFEN}`,
  backgroundRepeat: 'no-repeat, repeat',
  backgroundPosition: 'center, 0 0',
  backgroundSize: '38px 38px, auto',
  backgroundColor: '#c8bda4',
}

/** Fallback, solange `beschreibungstext` leer ist (DB-weit 0/279 befüllt).
 *  Bewusst nur im Frontend — es wird kein Lorem in die DB geschrieben. */
export const LOREM_BESCHREIBUNG =
  'Zu dieser Pflanze ist noch kein Beschreibungstext hinterlegt. ' +
  'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod ' +
  'tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. ' +
  'At vero eos et accusam et justo duo dolores et ea rebum, stet clita kasd gubergren.'

export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Botanischen Namen auf die Gattung kürzen (Kachel-Untertitel, wie Prototyp). */
export function shortBotanical(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts.length > 2 ? parts.slice(0, 2).join(' ') : name.trim()
}
