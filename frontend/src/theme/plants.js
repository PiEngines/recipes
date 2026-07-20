// Gemeinsame Bausteine der Kräuterschule (U1 Übersicht + U2 Detail).

import plantPlaceholder from '../assets/plant-placeholder.svg'

/** Foto-Platzhalter für ALLE Pflanzenbilder.
 *  Es gibt keine echten Pflanzenbilder — `bild_dateiname` wird bewusst ignoriert,
 *  bis echte Assets vorliegen. Dann reicht ein Tausch an dieser Stelle. */
export { plantPlaceholder }

/** Bild-Fläche mit Platzhalter, immer `cover`. */
export const plantImageStyle = {
  backgroundImage: `url(${plantPlaceholder})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

/** Fallback, solange `beschreibungstext` leer ist (DB-weit 0/279 befüllt).
 *  Bewusst nur im Frontend — es wird kein Lorem in die DB geschrieben. */
export const LOREM_BESCHREIBUNG =
  'Zu dieser Pflanze ist noch kein Beschreibungstext hinterlegt. ' +
  'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod ' +
  'tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. ' +
  'At vero eos et accusam et justo duo dolores et ea rebum, stet clita kasd gubergren.'

/** Reihenfolge der Kategorie-Reihen auf der Übersicht (SPEC §07). */
export const PLANT_CATEGORY_ORDER = [
  'Küchenkräuter',
  'Gemüse',
  'Obst',
  'Heilkräuter',
  'Wildkräuter',
]

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
