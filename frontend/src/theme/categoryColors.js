/* ─────────────────────────────────────────────────────────────────────────
 * Kategorie-Farbpalette (Wahl 2.0) — verbindlich, EIN Farbwert je Kategorie.
 * Quelle: design_handoff_piengines_v2/SPEC.md §1.3 · screens/farbkonzept.html
 *
 * EINZIGE Quelle der Wahrheit für Kategorie-Farben. Ab Phase G konsumiert von
 * Kategorie-Kacheln, Filter-Chips und SAISON-/Kategorie-Badges — dort NICHT
 * hart hex-kodieren, sondern hierüber (getCategoryColor / categoryGradient).
 *
 *   base = Kachel-/Chip-Grundfarbe (der eine Wert je Kategorie)
 *   dark = dunklerer Gradient-Stop für das Foto-Overlay (SPEC §1.3/§2.1),
 *          damit die Farbe auch über Bildern lesbar bleibt.
 * ───────────────────────────────────────────────────────────────────────── */

export const CATEGORY_COLORS = {
  // Zubereitung
  backen:        { label: 'Backen',        base: '#C67A1E', dark: '#7E4A10' },
  grillen:       { label: 'Grillen',       base: '#B2331E', dark: '#6E1C10' },
  einkochen:     { label: 'Einkochen',     base: '#2E8C86', dark: '#185450' },
  fermentieren:  { label: 'Fermentieren',  base: '#7A4CA0', dark: '#472A63' },
  // Gänge & Gerichte
  suppen:        { label: 'Suppen',        base: '#DD6236', dark: '#8F3418' },
  salate:        { label: 'Salate',        base: '#8FBE3E', dark: '#5C7A1F' },
  pasta:         { label: 'Pasta',         base: '#9E5A2C', dark: '#613218' },
  desserts:      { label: 'Desserts',      base: '#C25C93', dark: '#73305A' },
  // Garten & Vorrat
  kraeuter:      { label: 'Kräuter',       base: '#256D3A', dark: '#123C20' },
  aufstriche:    { label: 'Aufstriche',    base: '#B79A4E', dark: '#726026' },
  // Basis (app-weit)
  fruehstueck:   { label: 'Frühstück',     base: '#E4B23C', dark: '#9C7418' },
  hauptgerichte: { label: 'Hauptgerichte', base: '#3F72B0', dark: '#244A78' },
  getraenke:     { label: 'Getränke',      base: '#8A2E4E', dark: '#56182E' },
  // Pflanzen-Kategorien (Kräuterschule) — Pflanzentöne
  kuechenkraeuter: { label: 'Küchenkräuter', base: '#5A7D3F', dark: '#35501F' },
  gemuese:       { label: 'Gemüse',        base: '#B06A34', dark: '#6E3E18' },
  obst:          { label: 'Obst',          base: '#9E4E6E', dark: '#5E2942' },
  heilkraeuter:  { label: 'Heilkräuter',   base: '#8A7BA8', dark: '#52466A' },
  wildkraeuter:  { label: 'Wildkräuter',   base: '#6E7A3A', dark: '#414A20' },
}

/**
 * Neutraler Fallback-Ton für Rezepte/Objekte ohne (bekannte) Kategorie.
 * Werte aus farbkonzept.html (Label-/Meta-Töne) — kein Crash, Layout stabil.
 */
export const NEUTRAL_CATEGORY = { label: '', base: '#9a8870', dark: '#6a5c48' }

/** Kategoriename/-slug → stabiler Schlüssel (kleinschreibung, Umlaute entschärft). */
export function categorySlug(nameOrSlug) {
  return (nameOrSlug ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')
}

/** { label, base, dark } für eine Kategorie; neutraler Fallback wenn unbekannt/leer. */
export function getCategoryColor(nameOrSlug) {
  return CATEGORY_COLORS[categorySlug(nameOrSlug)] ?? NEUTRAL_CATEGORY
}

/** Verlaufs-Overlay `linear-gradient(135deg, base, dark)` — Foto-Overlay & Fallback-Farbblock (SPEC §2.1). */
export function categoryGradient(nameOrSlug) {
  const c = getCategoryColor(nameOrSlug)
  return `linear-gradient(135deg, ${c.base}, ${c.dark})`
}
