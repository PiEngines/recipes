/* ── Regale der Kräuterschule-Übersicht ──────────────────────────────────────
 * Die DB führt 21 feingranulare `hauptkategorie`-Werte („Küchenkraut",
 * „Blattgemüse", …), die SPEC kennt 5 Regale. Diese Tabelle bildet das ab;
 * alles Unzugeordnete landet in „Weitere" — es verschwindet nichts.
 *
 * Regalfarben kommen aus CATEGORY_COLORS (kein zweiter Hex-Ort): `key` ist
 * zugleich der CATEGORY_COLORS-Schlüssel. „weitere" ist dort bewusst nicht
 * hinterlegt und fällt damit automatisch auf NEUTRAL_CATEGORY (grau).
 *
 * Reines Modul (keine React-/Asset-Importe), damit direkt testbar.
 * ───────────────────────────────────────────────────────────────────────── */

/** Regale in Anzeigereihenfolge. */
export const PLANT_SHELVES = [
  { key: 'kuechenkraeuter', label: 'Küchenkräuter' },
  { key: 'gemuese', label: 'Gemüse' },
  { key: 'obst', label: 'Obst' },
  { key: 'heilkraeuter', label: 'Heilkräuter' },
  { key: 'wildkraeuter', label: 'Wildkräuter' },
  { key: 'weitere', label: 'Weitere' },
]

/** hauptkategorie (alle 21 DB-Werte) → Regal. */
export const HAUPTKATEGORIE_SHELF = {
  // Küchenkräuter
  'Küchenkraut': 'kuechenkraeuter',
  'Gewürzpflanze': 'kuechenkraeuter',
  // Gemüse
  'Blattgemüse': 'gemuese',
  'Fruchtgemüse': 'gemuese',
  'Wurzelgemüse': 'gemuese',
  'Kohlgemüse': 'gemuese',
  'Zwiebelgemüse': 'gemuese',
  'Knollengemüse': 'gemuese',
  'Stielgemüse': 'gemuese',
  'Blütengemüse': 'gemuese',
  'Hülsenfrucht': 'gemuese',
  // Obst
  'Obstpflanze': 'obst',
  'Wildobst': 'obst',
  // Heilkräuter (primär)
  'Teepflanze': 'heilkraeuter',
  'Duftpflanze': 'heilkraeuter',
  // Wildkräuter
  'Wildkraut': 'wildkraeuter',
  // Weitere
  'Essbare Blütenpflanze': 'weitere',
  'Nusspflanze': 'weitere',
  'Genusspflanze': 'weitere',
  'Süßpflanze': 'weitere',
  'Nutzpflanze': 'weitere',
}

/** Werte in `weitere_kategorien`, die eine Pflanze zusätzlich ins
 *  Heilkräuter-Regal holen (querschnittlich, z. B. Salbei). */
export const HEILKRAEUTER_TRIGGERS = ['Heilpflanze', 'Teepflanze', 'Tee', 'Duftpflanze']

/** `weitere_kategorien` ist ein `;`-getrennter Freitext (`|` defensiv mit). */
export function parseWeitereKategorien(value) {
  if (!value) return []
  return value.replace(/\|/g, ';').split(';').map(s => s.trim()).filter(Boolean)
}

/** Regal-Schlüssel für die `hauptkategorie` einer Pflanze (Detail-Chip). */
export function shelfForHauptkategorie(hauptkategorie) {
  return HAUPTKATEGORIE_SHELF[hauptkategorie?.trim()] || 'weitere'
}

/**
 * Alle Regale, in denen eine Pflanze steht — dedupliziert.
 * Primär über `hauptkategorie`, zusätzlich Heilkräuter über `weitere_kategorien`.
 * Eine Pflanze darf mehrfach erscheinen (Salbei: Küchenkräuter + Heilkräuter).
 */
export function shelvesForPlant(plant) {
  const shelves = new Set([shelfForHauptkategorie(plant?.hauptkategorie)])
  const nebenetiketten = parseWeitereKategorien(plant?.weitere_kategorien)
  if (nebenetiketten.some(t => HEILKRAEUTER_TRIGGERS.includes(t))) {
    shelves.add('heilkraeuter')
  }
  return [...shelves]
}
