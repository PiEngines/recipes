// Bring!-Integration (Deeplink je Rezept).
//
// Ablauf: Wir lassen uns einen signierten, kurzlebigen Klon-Link minten und
// schicken den User auf den Bring!-Deeplink. Bring! crawlt daraufhin die
// Klon-URL serverseitig und liest das schema.org/Recipe-JSON-LD.
// Das ist eine Top-Level-Navigation, kein fetch — CSP `connect-src` bleibt
// dadurch unberührt.

import client from './client'

const BRING_DEEPLINK = 'https://api.getbring.com/rest/bringrecipes/deeplink'

/** Signierten Klon-Link für ein Rezept erzeugen. */
export function createBringLink(recipeId, opts = {}) {
  return client.post(`/api/recipes/${recipeId}/bring-link`, null, opts).then(r => r.data)
}

/** Bring!-Deeplink für eine bereits gemintete Klon-URL. */
export function bringDeeplinkFor(shareUrl) {
  return `${BRING_DEEPLINK}?url=${encodeURIComponent(shareUrl)}&source=web`
}
