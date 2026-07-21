// Profil, Follow-Graph und die Fremdsicht auf verlinkte Beiträge (F3b-2a).
// Alle Calls über den zentralen Client — Auth-Header und 401-Handling stecken
// dort im Interceptor. Jede Funktion nimmt optional { signal }.

import client from './client'

/** Profilsicht: Identität, Bio und Follow-Zahlen. `is_following` ist der
 *  Startzustand des Folgen-Buttons. */
export function getProfile(userId, opts = {}) {
  return client.get(`/api/users/${userId}/profile`, opts).then(r => r.data)
}

export function followUser(userId, opts = {}) {
  return client.post(`/api/users/${userId}/follow`, null, opts)
}

export function unfollowUser(userId, opts = {}) {
  return client.delete(`/api/users/${userId}/follow`, opts)
}

/** Wer diesem User folgt — paginiert (`{items, total, page, page_size}`). */
export function getFollowers(userId, { page = 1, pageSize = 20, ...opts } = {}) {
  return client
    .get(`/api/users/${userId}/followers`, { ...opts, params: { page, page_size: pageSize } })
    .then(r => r.data)
}

/** Wem dieser User folgt — gleiche Form wie `getFollowers`. */
export function getFollowing(userId, { page = 1, pageSize = 20, ...opts } = {}) {
  return client
    .get(`/api/users/${userId}/following`, { ...opts, params: { page, page_size: pageSize } })
    .then(r => r.data)
}

/** Verlinkte Instagram-/TikTok-Beiträge eines Users (Fremdsicht fürs Profil). */
export function getUserExternalPosts(userId, opts = {}) {
  return client.get(`/api/users/${userId}/external-posts`, opts).then(r => r.data)
}

/**
 * Rezepte eines Autors. Fremde Profile liefern durch den Sichtbarkeitsfilter
 * automatisch nur Veröffentlichtes — Entwürfe sieht ausschliesslich der Autor.
 * Rückgabe ist die paginierte Form; `total` trägt die Rezept-Zahl im Kopf.
 */
export function getRecipesByAuthor(authorId, { page = 1, pageSize = 50, ...opts } = {}) {
  return client
    .get('/api/recipes', { ...opts, params: { author_id: authorId, page, page_size: pageSize } })
    .then(r => r.data)
}

/** Favoriten des angemeldeten Users (`RecipeListItem[]`). */
export function getFavorites(opts = {}) {
  return client.get('/api/favorites', opts).then(r => r.data)
}
