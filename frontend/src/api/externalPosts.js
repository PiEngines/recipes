// API für verlinkte Instagram-/TikTok-Beiträge (F3b-1).
// Alle Calls über den zentralen Client — Auth-Header und 401-Handling stecken
// dort im Interceptor. Jede Funktion nimmt optional { signal } für den
// AbortController beim Unmount.

import client from './client'

/** Plattform aus der URL ableiten — `null`, wenn es keine bekannte ist. */
export function platformAusUrl(url) {
  let host
  try {
    host = new URL(url.trim()).hostname.toLowerCase()
  } catch {
    return null
  }
  const passt = (domain) => host === domain || host.endsWith('.' + domain)

  if (passt('instagram.com') || passt('instagr.am')) return 'instagram'
  if (passt('tiktok.com')) return 'tiktok'
  return null
}

/** Eigene Beiträge. */
export function getPosts(opts = {}) {
  return client.get('/api/external-posts', opts).then(r => r.data)
}

/** Einzelner Beitrag inkl. Embed-HTML und Zutaten. */
export function getPost(postId, opts = {}) {
  return client.get(`/api/external-posts/${postId}`, opts).then(r => r.data)
}

/** Vorschau vor dem Speichern — legt nichts an. 502, wenn oEmbed scheitert. */
export function previewPost({ platform, url }, opts = {}) {
  return client.post('/api/external-posts/preview', { platform, url }, opts).then(r => r.data)
}

/** Beitrag speichern; der Server reichert per oEmbed an. */
export function createPost({ platform, url }, opts = {}) {
  return client.post('/api/external-posts', { platform, url }, opts).then(r => r.data)
}

/**
 * Beitrag pflegen. Nur mitgeschickte Felder werden angefasst:
 * - `caption_text` → Server parst die Zutaten neu
 * - `extracted_ingredients` → übernimmt die Liste unverändert (Handkorrektur)
 * - `recipe_id` → verknüpfen, `null` löst die Verknüpfung
 */
export function patchPost(postId, patch, opts = {}) {
  return client.patch(`/api/external-posts/${postId}`, patch, opts).then(r => r.data)
}

/** oEmbed erneut abrufen (z. B. nachdem der Abruf beim Anlegen scheiterte). */
export function refreshPost(postId, opts = {}) {
  return client.post(`/api/external-posts/${postId}/refresh`, null, opts).then(r => r.data)
}

/** Extrahierte Zutaten auf die Einkaufsliste legen. */
export function toShoppingList(postId, opts = {}) {
  return client.post(`/api/external-posts/${postId}/to-shopping-list`, null, opts).then(r => r.data)
}

/** Beitrag entfernen (204). */
export function deletePost(postId, opts = {}) {
  return client.delete(`/api/external-posts/${postId}`, opts)
}
