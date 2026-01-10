"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql://localhost:5432/inkflow"

    # Auth
    jwt_secret: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Encryption - Fernet key for sensitive data (empty = auto-generate dev key)
    encryption_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Email - SendGrid (empty = stub to console)
    sendgrid_api_key: str = ""
    from_email: str = "noreply@inkflow.local"
    inbound_email_domain: str = "inkflow.local"  # Domain for reply-to addresses

    # SMS - Twilio (empty = stub to console)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # App Settings
    app_name: str = "InkFlow"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    @property
    def async_database_url(self) -> str:
        """Convert standard postgres URL to async asyncpg URL."""
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def is_email_configured(self) -> bool:
        """Check if email sending is configured."""
        return bool(self.sendgrid_api_key)

    @property
    def is_sms_configured(self) -> bool:
        """Check if SMS sending is configured."""
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    @property
    def is_encryption_configured(self) -> bool:
        """Check if encryption key is configured."""
        return bool(self.encryption_key)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
