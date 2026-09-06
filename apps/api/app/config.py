import re
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
    posthog_enabled: bool = False
    posthog_api_key: str = ""
    posthog_host: str = "https://eu.i.posthog.com"
    api_base_url: str = "http://localhost:8100"
    sites_base_domain: str = "lvh.me:8080"

    database_url: str = "postgresql+psycopg://forge:forge@127.0.0.1:5434/rodium_forge"
    secret_key: str = "dev-secret-change-me"
    # Shared secret for RodiumAi Nest admin → Forge internal routes (X-Forge-Admin-Secret).
    admin_secret: str = ""
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
    # Public origin of THIS web app — used to build the links we email out
    # (verify email, reset password). Must be the URL a browser can reach.
    web_app_url: str = "http://localhost:3100"

    # ── Local accounts (email/password, Google, GitHub) ──────────────────────
    # Transport for transactional mail:
    #   smtp     → plain SMTP. The default, pointed at the Mailpit container in
    #              docker-compose: a real inbox at http://localhost:8026 with
    #              nothing to sign up for. Same setup the platform API uses.
    #   console  → write the link to the log. For running the API outside
    #              Docker, where there is no SMTP server to talk to.
    #   ses      → AWS SES via boto3 (needs the AWS_* credentials below)
    #   disabled → send nothing (verification links become unobtainable)
    mail_transport: Literal["smtp", "ses", "console", "disabled"] = "smtp"
    mail_from: str = "Forge By RodiumAi <noreply@rodiumai.io>"
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    #: Mailpit wants neither; a real relay will.
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    # Firebase Admin — verifies the Google/GitHub ID tokens minted in the browser.
    # All three empty → the social endpoints return 503 and the web app hides
    # the buttons, so a clone never shows an option that cannot work.
    firebase_project_id: str = ""
    firebase_client_email: str = ""
    firebase_private_key: str = ""

    # ── RodiumAi account provisioning (official instance only) ───────────────
    # Empty token → no-op. A clone creates local accounts and nothing else.
    rodium_provision_url: str = ""
    rodium_provision_token: str = ""
    projects_root: str = "./data/projects"
    # Forkable starter kits (Vite/React snapshots). Docker: /data/templates
    templates_root: str = "./data/templates"
    cors_origins: str = "http://localhost:3100,http://127.0.0.1:3100,http://localhost:8080"
    # LLM models (override via .env or the RodiumAi admin platform settings)
    # LITE_MODEL: small edits, classify, coherence
    # DEFAULT_MODEL: sections, medium edits, verify.repair
    # ESCALATION_MODEL: scaffold plans + large edits (strong instruction-following)
    # DEFAULT_IMAGE_MODEL: image generation
    lite_model: str = "google/gemini-3.7-flash"
    default_model: str = "google/gemini-3.7-flash"
    default_image_model: str = "openai/gpt-image-2"
    enable_pro_escalation: bool = True
    escalation_model: str = "anthropic/claude-sonnet-4-6"
    access_token_expire_minutes: int = 60 * 24 * 7
    preview_port_start: int = 5200
    preview_port_end: int = 5299
    preview_public_host: str = "lvh.me"
    preview_public_port: int = 3100
    preview_public_scheme: str = "http"
    # Parent origins allowed to talk to the preview runner (comma-separated)
    runner_parent_origins: str = "http://localhost:3100,http://127.0.0.1:3100"

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

    # Queue (Valkey / Redis Streams — same impl local and prod)
    queue_provider: Literal["redis"] = "redis"
    redis_url: str = "redis://127.0.0.1:6380/0"
    usage_stream: str = "sites:usage"
    usage_consumer_group: str = "billing"
    # SSE comment heartbeats so ALB/proxies with long idle timeouts stay open.
    sse_heartbeat_seconds: float = 15.0
    # Target ALB idle timeout (seconds) — document & IaC must match before streaming runs.
    # NOTE: nothing in this codebase reads this; it documents what the load
    # balancer must be configured to, and no IaC in this repo applies it.
    alb_idle_timeout_seconds: int = 600

    # A `running` run whose worker is neither local nor claimed for this long is
    # treated as interrupted; an `awaiting_clarify` / `awaiting_plan_confirm`
    # run untouched for this long is expired. Both exist because neither state
    # self-heals: production kept one prompt "awaiting confirmation" for 30h.
    stale_run_seconds: int = 3600
    abandoned_run_seconds: int = 86400

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
        scheme = "https" if self.environment in ("staging", "production") else "http"
        return f"{scheme}://{slug}.{self.sites_base_domain}"

    # ── Custom domains (Vercel-style CNAME flow) ────────────────────────────
    # CNAME target shown to users; empty → derived from sites_base_domain.
    custom_domain_cname_target: str = ""
    # AWS provisioning (ACM cert + ALB host rule). Both empty → degraded mode:
    # no ACM record, verify only checks the routing CNAME (local/dev/CI).
    custom_domain_alb_listener_arn: str = ""
    custom_domain_gateway_tg_arn: str = ""

    @property
    def effective_custom_domain_cname_target(self) -> str:
        if self.custom_domain_cname_target.strip():
            return self.custom_domain_cname_target.strip().rstrip(".")
        # Strip any :port — a CNAME target is a bare hostname.
        base = self.sites_base_domain.split(":")[0]
        return f"sites.{base}"

    @property
    def custom_domain_aws_enabled(self) -> bool:
        return bool(self.custom_domain_alb_listener_arn.strip() and self.custom_domain_gateway_tg_arn.strip())

    @property
    def object_store_enabled(self) -> bool:
        access, secret = self.resolved_object_store_credentials()
        bucket = self.bucket_uploads or self.aws_s3_bucket or self.bucket_site_assets
        if access and secret and bucket:
            return True
        # ECS/Fargate: IAM task role when static keys are unset in staging/production.
        return bool(not self.is_local and bucket)

    def resolved_object_store_credentials(self) -> tuple[str, str]:
        """Explicit S3 keys, or empty to use the default AWS credential chain (ECS task role)."""
        access = (self.object_store_access_key or self.aws_access_key_id or "").strip()
        secret = (self.object_store_secret_key or self.aws_secret_access_key or "").strip()
        if not self.is_local and access == "rodiumdev" and secret == "rodiumdev123":
            return "", ""
        return access, secret

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

    @property
    def rodium_provisioning_url(self) -> str:
        """Nest endpoint that creates a RodiumAi account + generation key.

        Defaults to the same host we already talk OIDC to, so the official
        instance only has to set the token.
        """
        base = (self.rodium_provision_url or self._rodium_oidc_server_base).rstrip("/")
        return base + "/api/v1/internal/provisioning/users"

    @property
    def provisioning_enabled(self) -> bool:
        return bool(self.rodium_provision_token.strip())

    @property
    def firebase_enabled(self) -> bool:
        return bool(
            self.firebase_project_id.strip()
            and self.firebase_client_email.strip()
            and self.firebase_private_key.strip()
        )

    @property
    def firebase_private_key_pem(self) -> str:
        r"""Env vars cannot hold real newlines, so the key ships with `\n`."""
        return self.firebase_private_key.replace("\\n", "\n")

    def web_url(self, path: str) -> str:
        return self.web_app_url.rstrip("/") + "/" + path.lstrip("/")

    @property
    def effective_default_model(self) -> str:
        from app.services.platform_settings import effective_model

        return effective_model("default_model", self.default_model)

    @property
    def effective_default_image_model(self) -> str:
        from app.services.platform_settings import effective_model

        return effective_model("default_image_model", self.default_image_model)

    @property
    def effective_lite_model(self) -> str:
        from app.services.platform_settings import effective_model

        return effective_model("lite_model", self.lite_model)

    @property
    def effective_escalation_model(self) -> str:
        from app.services.platform_settings import effective_model

        return effective_model("escalation_model", self.escalation_model)


_DEV_SECRET_KEYS = {"dev-secret-change-me", "dev-secret-forge-web", "", None}
# The .env.example placeholders are 32+ chars and slipped through the length
# check: a production API signing JWTs with a PUBLIC string from the repo lets
# anyone mint a valid token for any user id.
_PLACEHOLDER_SECRET_RE = re.compile(r"(?i)(change[-_ ]?me|placeholder|example|replace[-_ ]?with)")


def _is_placeholder_secret(value: str | None) -> bool:
    return bool(value) and bool(_PLACEHOLDER_SECRET_RE.search(value or ""))


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Garde-fou anti pied de biche : interdire les providers de développement en production.
    if s.environment == "production":
        assert s.key_provider == "kms", "KEY_PROVIDER doit être kms en production"
        assert s.secret_provider == "aws_secrets_manager", "SECRET_PROVIDER invalide en production"
        assert s.dev_master_key is None, "DEV_MASTER_KEY doit être absente en production"
        assert not s.object_store_endpoint or "minio" not in (s.object_store_endpoint or ""), (
            "OBJECT_STORE_ENDPOINT MinIO interdit en production"
        )
        # Le JWT de session ne doit jamais être signé avec une clé de développement.
        assert s.secret_key not in _DEV_SECRET_KEYS, "SECRET_KEY de développement interdite en production"
        assert len(s.secret_key) >= 32, "SECRET_KEY doit faire au moins 32 caractères en production"
        assert not _is_placeholder_secret(s.secret_key), (
            "SECRET_KEY ressemble à un placeholder de .env.example — générez une vraie clé aléatoire"
        )
        # ENCRYPTION_KEY doit être distincte : sinon compromettre le JWT compromet
        # aussi les clés API RodiumAi et les refresh tokens chiffrés au repos.
        assert s.encryption_key, "ENCRYPTION_KEY est obligatoire en production"
        assert s.encryption_key != s.secret_key, "ENCRYPTION_KEY doit différer de SECRET_KEY"
        assert not _is_placeholder_secret(s.encryption_key), (
            "ENCRYPTION_KEY ressemble à un placeholder — générez une vraie clé aléatoire"
        )
    return s


def clear_settings_cache() -> None:
    get_settings.cache_clear()
