// Sammlungen (F3b-2b) — gemischte Listen aus Rezepten und verlinkten Beiträgen.
// Alle Calls über den zentralen Client; Auth-Header und 401-Handling stecken
// dort im Interceptor. Jede Funktion nimmt optional { signal }.

import client from './client'

/** Eigene Sammlungen (`CollectionSummary[]`). */
export function getCollections(opts = {}) {
  return client.get('/api/collections', opts).then(r => r.data)
}

/** Eine Sammlung samt aufgelösten, gemischten Items (`CollectionDetail`). */
export function getCollection(id, opts = {}) {
  return client.get(`/api/collections/${id}`, opts).then(r => r.data)
}

export function createCollection({ name, visibility }, opts = {}) {
  return client.post('/api/collections', { name, visibility }, opts).then(r => r.data)
}

/** Name und/oder Sichtbarkeit ändern — nur der Owner darf das (serverseitig). */
export function patchCollection(id, patch, opts = {}) {
  return client.patch(`/api/collections/${id}`, patch, opts).then(r => r.data)
}

export function deleteCollection(id, opts = {}) {
  return client.delete(`/api/collections/${id}`, opts)
}

/**
 * Item aufnehmen. `itemType` ist 'recipe' oder 'external_post'.
 *
 * Doppeltes Hinzufügen ist ausdrücklich kein Fehler: der Server fängt es per
 * Unique ab und antwortet trotzdem mit 201 und der aktuellen
 * `CollectionSummary`. Ob es neu war, verrät nur `item_count` — der Aufrufer
 * vergleicht ihn mit dem vorherigen Stand, statt auf einen Statuscode zu warten.
 */
export function addCollectionItem(id, { itemType, itemId }, opts = {}) {
  return client
    .post(`/api/collections/${id}/items`, { item_type: itemType, item_id: itemId }, opts)
    .then(r => r.data)
}

export function removeCollectionItem(id, { itemType, itemId }, opts = {}) {
  return client.delete(`/api/collections/${id}/items/${itemType}/${itemId}`, opts)
}
