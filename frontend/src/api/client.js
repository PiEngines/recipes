import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

client.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function abmelden() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  window.location.href = '/login'
}

// Ein Refresh je Ablauf: laufen mehrere Requests gleichzeitig in den 401,
// warten sie alle auf dasselbe Promise, statt N Refreshes loszuschicken.
let refreshPromise = null

/**
 * Access-Token erneuern und im `localStorage` ablegen.
 *
 * Bewusst über das nackte `axios` statt über `client`: so landet ein 401 des
 * Refresh-Calls selbst nicht wieder in diesem Interceptor (Endlosschleife) und
 * das abgelaufene Access-Token wird gar nicht erst mitgeschickt.
 *
 * @returns {Promise<string>} das neue Access-Token
 */
function erneuereToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE}/api/auth/refresh`, {
        refresh_token: localStorage.getItem('refresh_token'),
      })
      .then(res => {
        localStorage.setItem('access_token', res.data.access_token)
        // Das Backend rotiert derzeit nicht, gibt den Token also unverändert
        // zurück — mitschreiben schadet nicht und trägt eine spätere Rotation.
        if (res.data.refresh_token) {
          localStorage.setItem('refresh_token', res.data.refresh_token)
        }
        return res.data.access_token
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

client.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config

    // Auf der Login-Seite ist ein 401 die falsche Anmeldung, kein Ablauf —
    // dort weder erneuern noch umleiten.
    if (
      error.response?.status !== 401 ||
      !original ||
      window.location.pathname.startsWith('/login')
    ) {
      return Promise.reject(error)
    }

    // Ohne Refresh-Token gibt es nichts zu erneuern, und ein zweiter 401 nach
    // dem Retry heißt: das frische Access-Token hilft auch nicht mehr.
    if (original._retry || !localStorage.getItem('refresh_token')) {
      abmelden()
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const token = await erneuereToken()
      original.headers.Authorization = `Bearer ${token}`
      return await client(original)
    } catch {
      // Refresh-Token abgelaufen (7 Tage) oder ungültig — jetzt echt raus.
      abmelden()
      return Promise.reject(error)
    }
  },
)

export default client
