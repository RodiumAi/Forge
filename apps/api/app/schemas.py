from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    #: False right after sign-up. The web app uses it to show the
    #: "confirm your address" banner without an extra round-trip.
    email_verified: bool = True


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None = None
    avatar_url: str | None = None
    rodium_linked: bool = False
    rodium_sub: str | None = None
    email_verified: bool = False
    #: True when this account has a local password, i.e. the settings screen
    #: should offer "change password" rather than "managed by RodiumAi".
    has_password: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Local account flows ────────────────────────────────────────────────────


class RegistrationResponse(BaseModel):
    """Deliberately carries no session token.

    An account is not usable until its address is confirmed, so registering
    hands back nothing to sign in with — only what the UI needs to tell the
    person where to look and to offer a resend.
    """

    ok: bool = True
    email: EmailStr
    email_verified: bool = False
    message: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8, max_length=512)


class ResendVerificationRequest(BaseModel):
    """Either an email (inbox screen) or the expired link token (verify page)."""

    email: EmailStr | None = None
    token: str | None = Field(default=None, min_length=8, max_length=512)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    password: str = Field(min_length=8, max_length=128)


class OAuthFirebaseRequest(BaseModel):
    id_token: str = Field(min_length=16)


class MediaTokenResponse(BaseModel):
    """Short-lived, read-only credential for browser-loaded resources."""

    token: str
    expires_in: int


class SimpleOkResponse(BaseModel):
    ok: bool = True
    message: str | None = None


class OAuthStartResponse(BaseModel):
    authorize_url: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str
    #: The one-time secret this browser generated before `/auth/rodium/start`.
    #: Proves the callback is being completed by whoever began the flow.
    state_binding: str | None = Field(default=None, max_length=256)


class RodiumWalletOut(BaseModel):
    balance_rodi: str | None = None
    reserved_rodi: str | None = None
    provided_total_rodi: str | None = None
    raw: dict = Field(default_factory=dict)


class RodiumApiKeyOut(BaseModel):
    id: str
    name: str
    prefix: str | None = None
    last4: str | None = None
    billing_source: str | None = None
    is_active: bool = True


class RodiumAccountOut(BaseModel):
    linked: bool
    #: Platform user id. Needed client-side to build the top-up link
    #: (`{userApp}/pay?uid=…`), so it must survive a settings refresh.
    rodium_sub: str | None = None
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    wallet: RodiumWalletOut | None = None
    api_keys: list[RodiumApiKeyOut] = Field(default_factory=list)
    selected_api_key_id: str | None = None
    has_generation_key: bool = False
    generation_key_hint: str | None = None


class RodiumSelectKeyRequest(BaseModel):
    api_key_id: str = Field(min_length=1, max_length=128)


class RodiumSelectKeyResponse(BaseModel):
    ok: bool = True
    selected_api_key_id: str
    has_generation_key: bool = True
    generation_key_hint: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChangeResponse(BaseModel):
    ok: bool = True
    #: Changing the password revokes every existing session; this re-issues
    #: one for the browser that made the change.
    access_token: str | None = None


class LogoutResponse(BaseModel):
    ok: bool = True


class SettingsOut(BaseModel):
    has_rodium_key: bool
    rodium_key_hint: str | None = None
    default_model: str | None = None


class SettingsUpdate(BaseModel):
    rodium_api_key: str | None = None


class RodiumKeyOut(BaseModel):
    configured: bool
    managed: bool = False
    credentials_hint: str | None = None
    supports_test: bool = True


class RodiumKeyUpdate(BaseModel):
    api_key: str | None = None


class RodiumTestRequest(BaseModel):
    rodium_api_key: str | None = None


class RodiumTestResponse(BaseModel):
    ok: bool
    message: str


class PluginOut(BaseModel):
    id: str
    family: str
    package: str
    version: str
    when_to_use: str
    import_example: str
    forbidden_alternatives: list[str] = Field(default_factory=list)
    installable: bool = True


class PluginFamilyOut(BaseModel):
    id: str
    plugins: list[PluginOut] = Field(default_factory=list)


class PluginsCatalogOut(BaseModel):
    families: list[PluginFamilyOut] = Field(default_factory=list)
    plugins: list[PluginOut] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    prompt: str | None = Field(default=None, max_length=8000)
    template_id: str | None = Field(default=None, max_length=64)


class ProjectOut(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
    preview_port: int | None
    preview_running: bool
    public_url: str | None = None
    sites_url: str | None = None
    custom_domain: str | None = None
    custom_domain_status: str | None = None
    template_id: str | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class ProjectStatsOut(BaseModel):
    slug: str
    status: str
    preview_running: bool
    published: bool
    published_at: datetime | None = None
    sites_url: str | None = None
    created_at: datetime
    updated_at: datetime
    visitors_total: int = 0
    visitors_7d: int = 0
    files_count: int = 0
    messages_count: int = 0
    agent_runs_count: int = 0
    comments_count: int = 0
    storage_bytes: int = 0
    tracking_ready: bool = False


class TemplateOut(BaseModel):
    id: str
    title: str
    description: str
    tags: list[str] = []
    boot_hint: str = ""
    accent: str | None = None
    bg: str | None = None
    preview_url: str | None = None


class ChatOut(BaseModel):
    id: UUID
    project_id: UUID
    title: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    thinking_text: str | None = None
    steps_json: str | None = None
    file_ops_json: str | None = None
    plan_json: str | None = None
    plan_meta_json: str | None = None
    task_class: str | None = None
    model_slug: str | None = None
    effort_label: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatCreate(BaseModel):
    title: str | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=50000)
    mode: str = Field(default="agent", pattern="^(agent|plan)$")


class ClarifyAnswersRequest(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


class ConfirmPlanRequest(BaseModel):
    plan: list[dict] | None = None
    # True = execute only the next pending task, then pause for confirmation.
    step_mode: bool = False


class BranchMessagesRequest(BaseModel):
    from_message_id: UUID
    content: str = Field(min_length=1, max_length=50000)
    mode: str = Field(default="agent", pattern="^(agent|plan)$")


class AgentRunOut(BaseModel):
    id: UUID
    status: str
    mode: str
    prompt: str = ""
    plan: list[dict] = Field(default_factory=list)
    plan_meta: dict = Field(default_factory=dict)
    clarify: list[dict] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class FileNode(BaseModel):
    path: str
    type: str  # file | dir
    children: list["FileNode"] | None = None


class FileContent(BaseModel):
    path: str
    content: str
    # Optimistic-concurrency token (short content hash).
    version: str = ""


class PreviewStatus(BaseModel):
    running: bool
    port: int | None = None
    url: str | None = None
    public_url: str | None = None
    mode: str = "babel_runner"
    runner_url: str | None = None
    entry: str = "src/main.tsx"
