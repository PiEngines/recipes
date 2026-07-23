/**
 * Schwierigkeitsgrad — gemeinsame Wort-Labels (BUG-65).
 *
 * Die Skala hat fünf Stufen (1…5). Die Vorschau im Wizard zeigte sie vorher
 * als „3/10" — falsche Skala und ein anderes Wort als die Detailseite. Beide
 * Flächen lesen die Labels jetzt von hier.
 *
 * Index 0 bleibt leer, damit `DIFF_LABELS[difficulty]` direkt greift.
 */
export const DIFF_LABELS = ['', 'Sehr leicht', 'Leicht', 'Mittel', 'Schwer', 'Sehr schwer']

/** Wort-Label zu einer Stufe; unbekannte Werte kommen als Zahl zurück. */
export function difficultyLabel(difficulty) {
  if (!difficulty) return null
  return DIFF_LABELS[difficulty] || String(difficulty)
}
