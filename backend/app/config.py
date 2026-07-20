from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: str
    environment: str = "production"
    backend_cors_origins: str = ""
    admin_email: str = "admin@example.com"
    admin_password: str = "changeme123"
    media_root: str = "/app/media"
    resend_api_key: str = ""
    email_from: str = "noreply@piengines.com"
    app_url: str = "https://recipes.piengines.com"
    # Gültigkeitsdauer des signierten Bring!-Klon-Links. Der Link wird beim
    # Öffnen der Rezeptseite gemintet, nicht erst beim Tippen — die Laufzeit
    # beginnt also schon beim Seitenaufruf. 2 h decken auch ab, dass die Seite
    # länger offen liegt oder der Link auf einem anderen Gerät geöffnet wird.
    bring_link_ttl_seconds: int = 7200

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
