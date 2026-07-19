/**
 * AuthShell — gemeinsames Chrome der Auth-Seiten (Phase G, aus Design-System
 * abgeleitet). Zentrierte weiße Akzent-Karte mit Holzkante (SPEC §2.4) auf
 * Creme-Grund, Marke/Logo + Lora-italic-Heading oben. Ausschließlich Tokens →
 * Dark-Mode greift automatisch.
 *
 * icon:     Emoji/ReactNode über dem Titel (aria-hidden)
 * title:    Lora-italic-Heading
 * subtitle: DM-Sans-Unterzeile (optional)
 * shake:    Fehler-Wackeln der Karte (Login/Register/Reset)
 */
import './auth.css'

export default function AuthShell({ icon, title, subtitle, shake = false, children }) {
  return (
    <div className="auth-shell">
      <div className={shake ? 'auth-shell__card shake' : 'auth-shell__card'}>
        <div className="auth-shell__head">
          {icon && <div className="auth-shell__icon" aria-hidden="true">{icon}</div>}
          <h1 className="auth-shell__title">{title}</h1>
          {subtitle && <p className="auth-shell__subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
