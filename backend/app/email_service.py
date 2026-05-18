import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.info("RESEND_API_KEY not set, email to %s skipped: %s", to, subject)
        return
    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
    except Exception:
        logger.exception("Failed to send email to %s", to)


_STYLE = (
    "font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;"
    " background: #ffffff; color: #1a1a1a; line-height: 1.6;"
)
_BTN = (
    "display: inline-block; padding: 12px 28px; background: #C8602A; color: #ffffff;"
    " text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.95rem;"
)


def send_invitation_email(
    to_email: str,
    token: str,
    invited_by_name: str,
    recipe_title: str | None = None,
) -> None:
    link = f"{settings.app_url}/register?token={token}"
    recipe_hint = (
        f"<p>Du erhältst Zugriff auf das Rezept: <strong>{recipe_title}</strong></p>"
        if recipe_title
        else ""
    )
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8602A">Einladung zu PiEngines Recipes</h2>
      <p><strong>{invited_by_name}</strong> lädt dich ein, PiEngines Recipes beizutreten.</p>
      {recipe_hint}
      <p><a href="{link}" style="{_BTN}">Jetzt registrieren</a></p>
      <p style="color:#888;font-size:0.85rem">Link gültig für 7 Tage.</p>
    </div>"""
    _send(to_email, f"{invited_by_name} lädt dich zu PiEngines Recipes ein", html)


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{settings.app_url}/reset-password?token={token}"
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8602A">Passwort zurücksetzen</h2>
      <p>Klicke auf den Button, um dein Passwort zurückzusetzen.</p>
      <p><a href="{link}" style="{_BTN}">Passwort zurücksetzen</a></p>
      <p style="color:#888;font-size:0.85rem">Link gültig für 1 Stunde. Wenn du diese E-Mail nicht angefordert hast, ignoriere sie.</p>
    </div>"""
    _send(to_email, "Passwort zurücksetzen – PiEngines Recipes", html)


def send_welcome_email(to_email: str, name: str) -> None:
    link = settings.app_url
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8602A">Willkommen, {name}!</h2>
      <p>Schön, dass du dabei bist. Entdecke leckere Rezepte auf PiEngines Recipes.</p>
      <p><a href="{link}" style="{_BTN}">Zu den Rezepten</a></p>
    </div>"""
    _send(to_email, "Willkommen bei PiEngines Recipes", html)


def send_review_result_email(
    to_email: str,
    recipe_title: str,
    approved: bool,
    comment: str | None = None,
) -> None:
    status_text = "genehmigt" if approved else "abgelehnt"
    status_color = "#6B7C4E" if approved else "#C84444"
    comment_html = f"<p><strong>Kommentar:</strong> {comment}</p>" if comment else ""
    html = f"""<div style="{_STYLE}">
      <h2 style="color:{status_color}">Änderungen {status_text}</h2>
      <p>Deine Änderungen am Rezept <strong>{recipe_title}</strong> wurden <strong>{status_text}</strong>.</p>
      {comment_html}
      <p><a href="{settings.app_url}" style="{_BTN}">Zum Rezept</a></p>
    </div>"""
    _send(to_email, f"Deine Änderungen wurden {status_text}", html)


def send_pending_registration_email(admin_email: str, user_name: str, user_email: str) -> None:
    link = f"{settings.app_url}/admin/users"
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8602A">Neue Registrierungsanfrage</h2>
      <p><strong>{user_name}</strong> ({user_email}) möchte beitreten.</p>
      <p><a href="{link}" style="{_BTN}">Zur Benutzerverwaltung</a></p>
    </div>"""
    _send(admin_email, "Neue Registrierungsanfrage – PiEngines Recipes", html)


def send_verification_email(to_email: str, name: str, token: str) -> None:
    link = f"{settings.app_url}/verify-email?token={token}"
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8602A">Email-Adresse bestätigen</h2>
      <p>Hallo <strong>{name}</strong>,</p>
      <p>bitte bestätige deine Email-Adresse, um dein Konto zu aktivieren.</p>
      <p><a href="{link}" style="{_BTN}">Email bestätigen</a></p>
      <p style="color:#888;font-size:0.85rem">Link gültig für 24 Stunden.</p>
    </div>"""
    _send(to_email, "Bitte bestätige deine Email – PiEngines Recipes", html)


def send_account_deleted_reminder(admin_email: str, user_name: str, days_remaining: int) -> None:
    html = f"""<div style="{_STYLE}">
      <h2 style="color:#C8A020">Konto-Löschung</h2>
      <p>Das Konto von <strong>{user_name}</strong> kann noch <strong>{days_remaining} Tage</strong> wiederhergestellt werden.</p>
      <p><a href="{settings.app_url}/admin/users" style="{_BTN}">Zur Benutzerverwaltung</a></p>
    </div>"""
    _send(
        admin_email,
        f"Konto von {user_name} kann noch {days_remaining} Tage wiederhergestellt werden",
        html,
    )
