/* ── Beet-Aufgaben: Darstellungslogik ────────────────────────────────────────
 * Reines Modul (keine React-/Asset-Importe), damit direkt testbar.
 * Die Ableitung selbst passiert im Backend (/api/garden/tasks); hier steht nur,
 * wie Aufgaben und Phasen dargestellt und priorisiert werden.
 * ───────────────────────────────────────────────────────────────────────── */

/** Phase-Badge je Pflanze — Werte kommen so aus dem Backend. */
export const PHASE_BADGES = {
  aussaat: { label: 'AUSSAAT', color: 'var(--blue)' },
  waechst: { label: 'WÄCHST', color: 'var(--green)' },
  ernte: { label: 'ERNTE', color: 'var(--gold)' },
}

export function phaseBadge(key) {
  return PHASE_BADGES[key] || PHASE_BADGES.waechst
}

/** Anzeigetext einer Aufgabe: Hinweis wenn vorhanden, sonst die Aktivität.
 *  (Nur 594 von 1744 Kalenderzeilen tragen überhaupt einen Hinweis.) */
export function taskLabel(task) {
  if (!task) return ''
  return task.hinweis?.trim() || task.aktivitaet || ''
}

/** Fälligkeitsspanne als Text, z. B. „Hochsommer" oder „Frühsommer – Hochsommer". */
export function taskPhaseSpan(task) {
  const parts = [task?.phase_von_name, task?.phase_bis_name].filter(Boolean)
  const uniq = [...new Set(parts)]
  return uniq.join(' – ')
}

/**
 * Der für eine Beet-Pflanze aussagekräftigste Eintrag.
 * Priorität: offene Aufgabe → erledigte Aufgabe → laufender Status.
 * Liefert `null`, wenn es zu der Pflanze nichts gibt.
 */
export function primaryTaskFor(tasks, userPlantId) {
  const mine = (tasks || []).filter(t => t.user_plant_id === userPlantId)
  if (mine.length === 0) return null
  const rank = t => (t.actionable && !t.done ? 0 : t.actionable ? 1 : 2)
  return [...mine].sort((a, b) => rank(a) - rank(b))[0]
}

/** Aufgaben nach Pflanze bündeln — für die Arbeits-Linse im Kalender. */
export function groupTasksByPlant(tasks) {
  const groups = new Map()
  for (const t of tasks || []) {
    if (!groups.has(t.user_plant_id)) {
      groups.set(t.user_plant_id, {
        user_plant_id: t.user_plant_id,
        plant_slug: t.plant_slug,
        deutscher_name: t.deutscher_name,
        tasks: [],
      })
    }
    groups.get(t.user_plant_id).tasks.push(t)
  }
  return [...groups.values()].sort((a, b) => a.deutscher_name.localeCompare(b.deutscher_name, 'de'))
}

/** Pflanzdatum kurz: „gepflanzt 18. Mai". */
export function plantedLabel(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  return `gepflanzt ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
}
