// Plants-/Garten-API (Kräuterschule, Pflanzen-Detail, Mein Beet).
// Alle Calls laufen über den zentralen Client — Auth-Header und 401-Handling
// stecken dort im Interceptor, hier bewusst nichts davon wiederholen.
// Jede Funktion nimmt optional { signal } für AbortController beim Unmount.

import client from './client'

/** Alle sichtbaren Pflanzen (279) — Suche/Gruppierung passiert clientseitig. */
export function getPlants(opts = {}) {
  return client.get('/api/plants', opts).then(r => r.data)
}

/** Pflanzen-Detail inkl. tags/relationen/kalender. */
export function getPlant(slug, opts = {}) {
  return client.get(`/api/plants/${encodeURIComponent(slug)}`, opts).then(r => r.data)
}

/** Monats-Kalender; ohne `monat` entscheidet der Server (aktueller Monat). */
export function getPlantCalendar(monat, opts = {}) {
  return client
    .get('/api/plants/calendar', { ...opts, params: monat ? { monat } : undefined })
    .then(r => r.data)
}

/** Phänophasen-Referenzdaten (10 Zeilen) — phase_id → ref_monat_von/bis. */
export function getPhases(opts = {}) {
  return client.get('/api/plants/phases', opts).then(r => r.data)
}

/** Kraut des Monats — innerhalb eines Monats stabil. */
export function getSpotlight(opts = {}) {
  return client.get('/api/plants/spotlight', opts).then(r => r.data)
}

/** Rezepte, die eine Pflanze verwenden. */
export function getPlantRecipes(slug, opts = {}) {
  return client.get(`/api/plants/${encodeURIComponent(slug)}/recipes`, opts).then(r => r.data)
}

// ── Mein Beet ────────────────────────────────────────────────────────────────

/** Eigenes Beet. */
export function getMyBeet(opts = {}) {
  return client.get('/api/garden/beet', opts).then(r => r.data)
}

/** Pflanze ins eigene Beet legen — idempotent, liefert den Eintrag. */
export function addToBeet(slug, opts = {}) {
  return client.post('/api/garden/beet', { plant_slug: slug }, opts).then(r => r.data)
}

/** Pflanze aus dem eigenen Beet entfernen (204). */
export function removeFromBeet(slug, opts = {}) {
  return client.delete(`/api/garden/beet/${encodeURIComponent(slug)}`, opts)
}

/** Pflanzdatum korrigieren — `plantedOn` als ISO-Datum ("YYYY-MM-DD"). */
export function patchBeet(slug, plantedOn, opts = {}) {
  return client
    .patch(`/api/garden/beet/${encodeURIComponent(slug)}`, { planted_on: plantedOn }, opts)
    .then(r => r.data)
}

// ── Beet-Aufgaben ────────────────────────────────────────────────────────────

/** Im aktuellen Monat fällige Aufgaben + laufende Status-Hinweise.
 *  `scope` kennt vorerst nur "month" — die Kalenderdaten haben ausschließlich
 *  Monatsauflösung, eine Wochen-Linse könnte nicht feiner filtern. */
export function getGardenTasks(opts = {}) {
  return client.get('/api/garden/tasks', { ...opts, params: { scope: 'month' } }).then(r => r.data)
}

/** Aufgabe für die laufende Periode abhaken (204, idempotent). */
export function markTaskDone(userPlantId, taskKey, opts = {}) {
  return client.post(
    `/api/garden/tasks/${userPlantId}/${encodeURIComponent(taskKey)}/done`, null, opts,
  )
}

/** Haken für die laufende Periode entfernen (204). */
export function unmarkTaskDone(userPlantId, taskKey, opts = {}) {
  return client.delete(
    `/api/garden/tasks/${userPlantId}/${encodeURIComponent(taskKey)}/done`, opts,
  )
}
