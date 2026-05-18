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

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
