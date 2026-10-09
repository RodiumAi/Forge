import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rodium_sub: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Set once the address is proven (verification link, or a Google/GitHub
    #: sign-in). This is the flag every account-linking decision hangs on:
    #: an unverified address must never be enough to claim an existing account.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Bumped on password change / reset. Session JWTs carry the value they
    #: were minted with, so bumping it invalidates every outstanding token —
    #: without it a 7-day JWT would survive a password reset.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    #: Set when RodiumAi admin suspends the linked platform account. Blocks
    #: every Forge session (JWT `tv` bump + this flag) until restored.
    access_blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: When a RodiumAi account was created for this user by the provisioning
    #: call. Distinct from `rodium_sub`, which means "we hold OAuth tokens".
    rodium_provisioned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    settings: Mapped["UserSettings | None"] = relationship(back_populates="user", uselist=False)
    projects: Mapped[list["Project"]] = relationship(back_populates="user")


class AuthToken(Base):
    """Single-use, hashed token backing email verification and password reset.

    Only the sha256 of the token is stored, so a database leak does not hand
    over working links — same posture as `OAuthAuthorizationCode.codeHash` on
    the RodiumAi side. One table for both kinds because they differ only by
    TTL and by what `consume()` is allowed to do next.
    """

    __tablename__ = "auth_tokens"

    KIND_EMAIL_VERIFY = "email_verify"
    KIND_PASSWORD_RESET = "password_reset"
    KIND_TEAM_SEAT_REMOVE = "team_seat_remove"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamSeat(Base):
    """One paid team place offered to someone other than the owner."""

    __tablename__ = "team_seats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OauthAccount(Base):
    """A federated identity (Google / GitHub) bound to a Forge user.

    Mirrors `OauthAccount` on the RodiumAi side. Its existence is what makes
    a social login idempotent: the second sign-in matches on
    `(provider, provider_account_id)` rather than falling back to an email
    comparison, which is the part that can be abused.
    """

    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_account_id: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    rodium_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    rodium_api_key_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    rodium_access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    rodium_refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    rodium_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rodium_wallet_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    rodium_api_keys_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_rodium_api_key_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payment_country_iso: Mapped[str | None] = mapped_column(String(2), nullable=True)
    default_model: Mapped[str] = mapped_column(String(128), nullable=False, default="google/gemini-3.7-flash")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="settings")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    preview_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_running: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    design_brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # "web" | "mobile" — mobile = app-shell prototype + PWA manifest-only.
    platform: Mapped[str] = mapped_column(String(16), nullable=False, default="web")
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")
    billing_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="owner_pays")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (UniqueConstraint("slug", name="uq_projects_slug"),)

    user: Mapped[User] = relationship(back_populates="projects")
    chats: Mapped[list["Chat"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    collaborators: Mapped[list["ProjectCollaborator"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="chats")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    thinking_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_ops_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_slug: Mapped[str | None] = mapped_column(String(128), nullable=True)
    effort_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chat: Mapped[Chat] = relationship(back_populates="messages")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="agent")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    clarify_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    answers_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Merged request + clarification answers, read by the planner and tasks.
    brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: AI clarity gauge score (0-100) for the request, when it was assessed.
    clarity_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plan_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_slug: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cursor_task_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ForgePlatformSettings(Base):
    __tablename__ = "forge_platform_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    default_image_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lite_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    escalation_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ModelCatalog(Base):
    __tablename__ = "model_catalog"

    slug: Mapped[str] = mapped_column(String(128), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    tier: Mapped[str] = mapped_column(String(32), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="text")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    context_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price_in_per_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_out_per_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SiteUsageDay(Base):
    __tablename__ = "site_usage_days"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=True
    )
    day: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    emails_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    page_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unique_visitors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("user_id", "project_id", "day", name="uq_site_usage_day"),)


class SitePageDay(Base):
    """Page views per path and day for a published site (top pages)."""

    __tablename__ = "site_page_days"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    day: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(300), nullable=False)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("project_id", "day", "path", name="uq_site_page_day"),)


class FormSubmission(Base):
    """A visitor form sent from a published site (`@forge/forms`)."""

    __tablename__ = "form_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    form_name: Mapped[str] = mapped_column(String(64), nullable=False)
    data_json: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    visitor_hash: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class StoredObject(Base):
    __tablename__ = "stored_objects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=True
    )
    object_key: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(200), nullable=False, default="application/octet-stream")
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    public_url: Mapped[str] = mapped_column(Text, nullable=False)
    adapter: Mapped[str] = mapped_column(String(32), nullable=False, default="s3")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectDomainClaim(Base):
    """Short-lived ownership proof that does not reserve a hostname globally."""

    __tablename__ = "project_domain_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    hostname: Mapped[str] = mapped_column(String(253), index=True, nullable=False)
    cname_target: Mapped[str] = mapped_column(String(253), nullable=False)
    ownership_txt_name: Mapped[str] = mapped_column(String(300), nullable=False)
    ownership_txt_value: Mapped[str] = mapped_column(String(300), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (UniqueConstraint("project_id", name="uq_project_domain_claims_project"),)


class ProjectDomain(Base):
    """Custom domain attached to a project (1 primary domain max per project).

    Status flow: pending_dns → processing → validated | failed.
    The Forge slug stays the S3 key — only Host routing and the displayed
    public URL change once validated.
    """

    __tablename__ = "project_domains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    hostname: Mapped[str] = mapped_column(String(253), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending_dns")
    cname_target: Mapped[str] = mapped_column(String(253), nullable=False, default="")
    acm_validation_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    acm_validation_value: Mapped[str | None] = mapped_column(String(300), nullable=True)
    acm_certificate_arn: Mapped[str | None] = mapped_column(String(300), nullable=True)
    acm_idempotency_token: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ownership_txt_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ownership_txt_value: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ownership_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("hostname", name="uq_project_domains_hostname"),
        UniqueConstraint("project_id", name="uq_project_domains_project"),
    )


class PreviewComment(Base):
    __tablename__ = "preview_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    selector: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    anchor_label: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ForgeEntitlementCache(Base):
    __tablename__ = "forge_entitlement_cache"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    plan_slug: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    max_projects: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_selection: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    custom_domain: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    export_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    history_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    history_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority_generation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_model_tiers: Mapped[str | None] = mapped_column(Text, nullable=True)
    frodi_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectCollaborator(Base):
    __tablename__ = "project_collaborators"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="editor")
    invited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    frodi_cap_per_cycle: Mapped[int | None] = mapped_column(Integer, nullable=True)

    project: Mapped[Project] = relationship(back_populates="collaborators")


class ProjectInvite(Base):
    """Email invitation that exists before the person accepts, and before they have an account.

    Access stays on ``project_collaborators`` and only after ``accepted_at`` is set.
    The raw token is mailed once; the row keeps its sha256.
    """

    __tablename__ = "project_invites"
    __table_args__ = (UniqueConstraint("project_id", "email", name="uq_project_invites_project_email"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="editor")
    invited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    frodi_cap_per_cycle: Mapped[int | None] = mapped_column(Integer, nullable=True)
