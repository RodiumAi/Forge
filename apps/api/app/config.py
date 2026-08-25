from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["local", "test", "staging", "production"] = "local"
    log_level: str = "info"
    api_base_url: str = "http://localhost:8100"
    sites_base_domain: str = "lvh.me:8080"

    database_url: str = "postgresql+psycopg://forge:forge@127.0.0.1:5434/forge_web"
    secret_key: str = "dev-secret-change-me"
    encryption_key: str = ""
    # Local RodiumAi FastAPI gateway (LLM). Override for prod.
    rodium_base_url: str = "http://127.0.0.1:8001/v1"
    # Local RodiumAi NestJS OIDC issuer (Sign in with RodiumAi).
    # Browser-facing authorize URL (must resolve on the host).
    rodium_oidc_issuer: str = "http://127.0.0.1:3001"
    # Server-side token/userinfo base when API runs in Docker (host.docker.internal).
    # Empty → same as rodium_oidc_issuer.
    rodium_oidc_internal_issuer: str = ""
    rodium_oidc_client_id: str = ""
    rodium_oidc_client_secret: str = ""
    rodium_oidc_redirect_uri: str = "http://localhost:3100/auth/callback"
    rodium_oidc_scopes: str = "openid profile email api_keys.read wallet.read"
    # Public origin of the RodiumAi user app (avatars often live there locally).
    rodium_user_app_url: str = "http://localhost:3000"
    projects_root: str = "./data/projects"
    # Forkable starter kits (Vite/React snapshots). Docker: /data/templates
    templates_root: str = "./data/templates"
    cors_origins: str = "http://localhost:3100,http://127.0.0.1:3100,http://localhost:8080"
    # Text/code default (Gemini). Images use default_image_model for tests.
    default_model: str = "google/gemini-3.7-flash"
    default_image_model: str = "openai/gpt-image-2"
    enable_pro_escalation: bool = False
    access_token_expire_minutes: int = 60 * 24 * 7
    preview_port_start: int = 5200
    preview_port_end: int = 5299
    # Vite live preview (Next middleware). Sites Gateway routing uses sites_base_domain + Caddy.
    preview_public_host: str = "lvh.me"
    preview_public_port: int = 3100
    preview_public_scheme: str = "http"

    # Object store (MinIO local / S3 or R2 in production)
    object_store_provider: Literal["s3_compatible"] = "s3_compatible"
    object_store_endpoint: str | None = "http://127.0.0.1:9000"
    object_store_public_endpoint: str | None = "http://localhost:9000"
    object_store_access_key: str = "rodiumdev"
    object_store_secret_key: str = "rodiumdev123"
    object_store_region: str = "us-east-1"
    object_store_addressing: Literal["path", "virtual"] = "path"
    object_store_prefix: str = "forge"
    bucket_site_assets: str = "forge-assets"
    bucket_uploads: str = "forge-uploads"
    bucket_runtime: str = "forge-runtime"

    # Legacy AWS_* aliases (SES / prod S3). Prefer OBJECT_STORE_* for storage.
    filesystem: str = "s3"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_region: str = "eu-west-1"
    aws_s3_bucket: str = ""
    aws_s3_public_base_url: str = ""
    aws_s3_prefix: str = "forge"

    # Encryption
    key_provider: Literal["local", "kms"] = "local"
    dev_master_key: str | None = "SFyCEKXp4zIrhIu6Lh9Vbh/RiVLjWbNVsik7dw+uBvg="
    kms_key_id: str | None = None

    # Secrets
    secret_provider: Literal["env", "aws_secrets_manager"] = "env"
    site_jwt_master_secret: str | None = "ZGV2LWp3dC1tYXN0ZXItc2VjcmV0LWNoYW5nZS1tZQ=="
    site_jwt_master_secret_previous: str | None = None

    # Email (Mailpit local / SES or Resend in production)
    mail_provider: Literal["smtp", "ses", "resend"] = "smtp"
    smtp_host: str | None = "127.0.0.1"
    smtp_port: int = 11025
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_tls: bool = False
    mail_from: str = "no-reply@sites.rodiumai.local"
    mail_transport: str = "smtp"
    ses_region: str = "eu-west-1"
    ses_from_email: str = "forge@rodiumai.io"
    ses_from_name: str = "Forge"
    resend_api_key: str = ""

    # Queue (Valkey / Redis Streams — same impl local and prod)
    queue_provider: Literal["redis"] = "redis"
    redis_url: str = "redis://127.0.0.1:6380/0"
    usage_stream: str = "sites:usage"
    usage_consumer_group: str = "billing"
    build_queue: str = "sites:builds"

    managed_email_daily_limit: int = 25
    managed_storage_bytes_limit: int = 500 * 1024 * 1024

    @property
    def is_local(self) -> bool:
        return self.environment in ("local", "test")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str:
        # Vite preview + Sites Gateway both use lvh.me (different ports).
        preview = self.preview_public_host.replace(".", r"\.")
        return rf"https?://([a-z0-9-]+\.)?{preview}(:\d+)?"

    def preview_url_for_slug(self, slug: str) -> str:
        port = f":{self.preview_public_port}" if self.preview_public_port else ""
        return f"{self.preview_public_scheme}://{slug}.{self.preview_public_host}{port}"

    def sites_url_for_slug(self, slug: str) -> str:
        return f"http://{slug}.{self.sites_base_domain}"

    @property
    def object_store_enabled(self) -> bool:
        access = self.object_store_access_key or self.aws_access_key_id
        secret = self.object_store_secret_key or self.aws_secret_access_key
        bucket = self.bucket_uploads or self.aws_s3_bucket
        return bool(access and secret and bucket)

    @property
    def s3_enabled(self) -> bool:
        return self.object_store_enabled

    @property
    def projects_path(self) -> Path:
        path = Path(self.projects_root).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def templates_path(self) -> Path:
        path = Path(self.templates_root).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def _rodium_oidc_server_base(self) -> str:
        return (self.rodium_oidc_internal_issuer or self.rodium_oidc_issuer).rstrip("/")

    @property
    def rodium_oidc_authorize_url(self) -> str:
        return self.rodium_oidc_issuer.rstrip("/") + "/api/v1/oauth/authorize"

    @property
    def rodium_oidc_token_url(self) -> str:
        return self._rodium_oidc_server_base + "/api/v1/oauth/token"

    @property
    def rodium_oidc_userinfo_url(self) -> str:
        return self._rodium_oidc_server_base + "/api/v1/oauth/userinfo"

    @property
    def rodium_oidc_api_keys_url(self) -> str:
        return self._rodium_oidc_server_base + "/api/v1/oauth/api-keys"

    @property
    def rodium_oidc_wallet_url(self) -> str:
        return self._rodium_oidc_server_base + "/api/v1/oauth/wallet"

    @property
    def rodium_oidc_revoke_url(self) -> str:
        return self._rodium_oidc_server_base + "/api/v1/oauth/revoke"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Garde-fou anti pied de biche : interdire les providers de développement en production.
    if s.environment == "production":
        assert s.key_provider == "kms", "KEY_PROVIDER doit être kms en production"
        assert s.secret_provider == "aws_secrets_manager", "SECRET_PROVIDER invalide en production"
        assert s.mail_provider != "smtp", "SMTP interdit en production"
        assert s.dev_master_key is None, "DEV_MASTER_KEY doit être absente en production"
        assert not s.object_store_endpoint or "minio" not in (s.object_store_endpoint or ""), (
            "OBJECT_STORE_ENDPOINT MinIO interdit en production"
        )
    return s


def clear_settings_cache() -> None:
    get_settings.cache_clear()
