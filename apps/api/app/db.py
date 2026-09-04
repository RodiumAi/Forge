from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# Pool sized for an SSE-heavy API: streams + background plan jobs are long-
# lived, and the default 5+10 pool exhausted under a single active plan run
# (every request then failed with QueuePool timeout → "Network request failed"
# cascades in the builder). Sessions must still release connections before
# long awaits — see the `db.commit()` calls ahead of LLM streams.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    # Chat/plan SSE + background jobs must not starve login/dashboard under load.
    # Prefer LIFO so bursty traffic reuses hot connections; recycle before NAT/idle drops.
    pool_size=25,
    max_overflow=35,
    pool_timeout=20,
    pool_recycle=1800,
    pool_use_lifo=True,
)
# expire_on_commit=False avoids DetachedInstanceError when request-scoped
# User/Settings objects are reused after commits (token refresh, streaming).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from sqlalchemy import text

    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # Lightweight local schema upgrades (no Alembic yet).
    statements = [
        "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS rodium_sub VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        "ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_rodium_sub ON users (rodium_sub)",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rodium_access_token_encrypted TEXT",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rodium_refresh_token_encrypted TEXT",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rodium_token_expires_at TIMESTAMPTZ",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rodium_wallet_json TEXT",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rodium_api_keys_json TEXT",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS selected_rodium_api_key_id VARCHAR(64)",
        """
        CREATE TABLE IF NOT EXISTS site_usage_days (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            day VARCHAR(10) NOT NULL,
            emails_sent INTEGER NOT NULL DEFAULT 0,
            storage_bytes INTEGER NOT NULL DEFAULT 0
        )
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_site_usage_day
        ON site_usage_days (user_id, project_id, day)
        """,
        """
        CREATE TABLE IF NOT EXISTS stored_objects (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            object_key TEXT NOT NULL,
            content_type VARCHAR(200) NOT NULL DEFAULT 'application/octet-stream',
            byte_size INTEGER NOT NULL DEFAULT 0,
            public_url TEXT NOT NULL,
            adapter VARCHAR(32) NOT NULL DEFAULT 's3',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_brief TEXT",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id VARCHAR(64)",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        # Site URLs are global ({slug}.lvh.me) — slug must be unique across all users.
        """
        DO $$
        DECLARE r RECORD;
            n INT;
            base TEXT;
            candidate TEXT;
        BEGIN
          FOR r IN
            SELECT id, slug,
                   ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn
            FROM projects
          LOOP
            IF r.rn > 1 THEN
              base := left(r.slug, 70);
              n := r.rn;
              LOOP
                candidate := base || '-' || n::text;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM projects WHERE slug = candidate);
                n := n + 1;
              END LOOP;
              UPDATE projects SET slug = candidate WHERE id = r.id;
            END IF;
          END LOOP;
        END $$;
        """,
        "ALTER TABLE projects DROP CONSTRAINT IF EXISTS uq_projects_user_slug",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_slug ON projects (slug)",
        "ALTER TABLE site_usage_days ADD COLUMN IF NOT EXISTS page_views INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE site_usage_days ADD COLUMN IF NOT EXISTS unique_visitors INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS thinking_text TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS steps_json TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_ops_json TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS task_class VARCHAR(64)",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS model_slug VARCHAR(128)",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS effort_label VARCHAR(32)",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS plan_json TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS plan_meta_json TEXT",
        """
        CREATE TABLE IF NOT EXISTS agent_runs (
            id UUID PRIMARY KEY,
            chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mode VARCHAR(16) NOT NULL DEFAULT 'agent',
            status VARCHAR(32) NOT NULL DEFAULT 'running',
            prompt TEXT NOT NULL DEFAULT '',
            clarify_json TEXT,
            answers_json TEXT,
            plan_json TEXT,
            task_class VARCHAR(64),
            model_slug VARCHAR(128),
            cursor_task_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_agent_runs_chat_id ON agent_runs (chat_id)",
        "ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS plan_meta_json TEXT",
        """
        CREATE TABLE IF NOT EXISTS model_catalog (
            slug VARCHAR(128) PRIMARY KEY,
            provider VARCHAR(32) NOT NULL,
            tier VARCHAR(32) NOT NULL,
            role VARCHAR(16) NOT NULL DEFAULT 'text',
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            context_tokens INTEGER NOT NULL DEFAULT 0,
            max_output_tokens INTEGER NOT NULL DEFAULT 0,
            price_in_per_m DOUBLE PRECISION,
            price_out_per_m DOUBLE PRECISION,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "UPDATE user_settings SET default_model = 'google/gemini-3.7-flash' WHERE default_model = 'openai/gpt-4o'",
        """
        CREATE TABLE IF NOT EXISTS forge_platform_settings (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            default_model VARCHAR(128),
            default_image_model VARCHAR(128),
            lite_model VARCHAR(128),
            escalation_model VARCHAR(128),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "INSERT INTO forge_platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING",
        """
        CREATE TABLE IF NOT EXISTS project_domains (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            hostname VARCHAR(253) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending_dns',
            cname_target VARCHAR(253) NOT NULL DEFAULT '',
            acm_validation_name VARCHAR(300),
            acm_validation_value VARCHAR(300),
            acm_certificate_arn VARCHAR(300),
            last_error TEXT,
            verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_project_domains_hostname ON project_domains (hostname)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_project_domains_project ON project_domains (project_id)",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))

    from app.services.orchestration.catalog import seed_model_catalog

    with SessionLocal() as session:
        seed_model_catalog(session)
