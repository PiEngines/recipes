// Einkaufslisten-API. Alle Calls über den zentralen Client — Auth-Header und
// 401-Handling stecken dort im Interceptor.
// Jede Funktion nimmt optional { signal } für AbortController beim Unmount.

import client from './client'

/** Liste + Fortschritt. `group`: "recipe" (default) oder "sum". */
export function getList(group = 'recipe', opts = {}) {
  return client.get('/api/shopping-list', { ...opts, params: { group } }).then(r => r.data)
}

/** Manuelle Position anlegen. */
export function addManual({ name, amount, unit }, opts = {}) {
  return client
    .post('/api/shopping-list/items', { name, amount: amount || null, unit: unit || null }, opts)
    .then(r => r.data)
}

/** Zutaten eines Rezepts übernehmen — Mengen werden auf `servings` eingefroren. */
export function addFromRecipe({ recipeId, servings, ingredientIds }, opts = {}) {
  return client
    .post('/api/shopping-list/from-recipe', {
      recipe_id: recipeId,
      servings,
      ingredient_ids: ingredientIds,
    }, opts)
    .then(r => r.data)
}

/** Position abhaken bzw. Haken entfernen. */
export function toggleItem(itemId, checked, opts = {}) {
  return client
    .patch(`/api/shopping-list/items/${itemId}`, { checked }, opts)
    .then(r => r.data)
}

/** Position bearbeiten (Name/Menge/Einheit). */
export function updateItem(itemId, patch, opts = {}) {
  return client.patch(`/api/shopping-list/items/${itemId}`, patch, opts).then(r => r.data)
}

/** Position entfernen (204). */
export function deleteItem(itemId, opts = {}) {
  return client.delete(`/api/shopping-list/items/${itemId}`, opts)
}

/** Alle erledigten Positionen entfernen. */
export function clearDone(opts = {}) {
  return client.post('/api/shopping-list/clear-done', null, opts).then(r => r.data)
}
