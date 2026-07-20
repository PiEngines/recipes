// Reine Kalender-Logik der Kräuterschule (keine React-/Asset-Importe, damit
// direkt testbar). Phänophasen → Monate; Referenzdaten kommen aus
// GET /api/plants/phases, nicht aus einer Frontend-Konstante.

/** Timeline-Zeilen (abgestimmt): „Aussaat" fasst Aussaat/Direktsaat/Vorkultur
 *  zusammen; „Ernte" kommt aus der Kalender-Gruppe `nutzung`, nicht `anbau`.
 *  Teilung/Vermehrung, Blüte, Rückschnitt etc. gehören NICHT in die Timeline —
 *  sie erscheinen nur in den Anbauhinweis-Karten. */
export const TIMELINE_ROWS = [
  { key: 'aussaat', label: 'Aussaat', color: 'var(--blue)', group: 'anbau', activities: ['Aussaat', 'Direktsaat', 'Vorkultur'] },
  { key: 'pflanzung', label: 'Pflanzung', color: 'var(--green)', group: 'anbau', activities: ['Pflanzung'] },
  { key: 'ernte', label: 'Ernte', color: 'var(--gold)', group: 'nutzung', activities: ['Ernte'] },
]

/** Aktivitäten, die auf der Übersicht unter „Säen" zusammengefasst werden. */
export const SAAT_ACTIVITIES = ['Aussaat', 'Direktsaat', 'Vorkultur']

/**
 * Monate (1..12), die ein Kalender-Eintrag über seine Phänophasen abdeckt.
 *
 * @param {{phase_von: number|null, phase_bis: number|null, laufend: boolean}} entry
 * @param {Record<number, {ref_monat_von: number, ref_monat_bis: number}>} phaseMap
 * @returns {Set<number>} Monate 1..12
 *
 * Spannen dürfen über den Jahreswechsel laufen (Phase 10 „Winter": 12 → 1).
 * Einträge ohne Phasen gelten nur dann als ganzjährig, wenn `laufend` gesetzt ist.
 */
export function monthsForEntry(entry, phaseMap) {
  if (entry.phase_von == null || entry.phase_bis == null) {
    return entry.laufend ? new Set(Array.from({ length: 12 }, (_, i) => i + 1)) : new Set()
  }
  const von = phaseMap[entry.phase_von]?.ref_monat_von
  const bis = phaseMap[entry.phase_bis]?.ref_monat_bis
  if (von == null || bis == null) return new Set()

  const months = new Set()
  let m = von
  for (let guard = 0; guard < 12; guard++) {
    months.add(m)
    if (m === bis) break
    m = m === 12 ? 1 : m + 1
  }
  return months
}

/** phase_id → Phasen-Datensatz. */
export function buildPhaseMap(phases) {
  const map = {}
  ;(phases || []).forEach(p => { map[p.phase_id] = p })
  return map
}
