from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectorField:
    id: str
    label_en: str
    label_fr: str
    secret: bool = True
    placeholder: str = ""
    required: bool = True


@dataclass(frozen=True)
class ConnectorDefinition:
    id: str
    name: str
    category: str  # ai | database | auth | email | payments | media
    description_en: str
    description_fr: str
    use_case_en: str
    use_case_fr: str
    auth_type: str  # api_key | oauth | install
    supports_test: bool = False
    fields: tuple[ConnectorField, ...] = ()
    capability: str | None = None  # data | auth | storage | email | payment | ai


CONNECTORS: tuple[ConnectorDefinition, ...] = (
    ConnectorDefinition(
        id="rodiumai",
        name="RodiumAi",
        category="ai",
        description_en="Linked automatically when you Sign in with RodiumAi. Powers Forge chat and AI features.",
        description_fr="Lié automatiquement via Se connecter avec RodiumAi. Alimente le chat Forge et l’IA.",
        use_case_en="Generate code, pages and business logic with RodiumAi inside your projects.",
        use_case_fr="Générez du code, des pages et de la logique métier avec RodiumAi dans vos projets.",
        auth_type="oauth",
        supports_test=True,
        capability="ai",
        fields=(),
    ),
    ConnectorDefinition(
        id="supabase",
        name="Supabase",
        category="database",
        description_en="PostgreSQL database, realtime, storage and auth for full-stack apps.",
        description_fr="Base PostgreSQL, temps réel, stockage et auth pour apps full-stack.",
        use_case_en="Let Forge wire tables, RLS policies and Supabase client code into your app.",
        use_case_fr="Permet à Forge d’intégrer tables, policies RLS et client Supabase dans votre app.",
        auth_type="api_key",
        capability="data",
        fields=(
            ConnectorField("project_url", "Project URL", "URL du projet", False, "https://xxx.supabase.co"),
            ConnectorField("anon_key", "Anon key", "Clé anon", True, "eyJ…"),
            ConnectorField("service_role_key", "Service role key", "Clé service_role", True, "eyJ…"),
            ConnectorField("db_password", "Database password", "Mot de passe DB", True, "", False),
            ConnectorField("jwt_secret", "JWT secret", "Secret JWT", True, "", False),
        ),
    ),
    ConnectorDefinition(
        id="firebase",
        name="Firebase",
        category="auth",
        description_en="Google Firebase for authentication and app backend services.",
        description_fr="Google Firebase pour l’authentification et les services backend.",
        use_case_en="Add email, Google or phone sign-in to apps generated with Forge.",
        use_case_fr="Ajoutez connexion email, Google ou téléphone aux apps générées avec Forge.",
        auth_type="api_key",
        capability="auth",
        fields=(
            ConnectorField("project_id", "Project ID", "ID projet", False, "my-app-prod"),
            ConnectorField("api_key", "Web API key", "Clé API Web", True, "AIza…"),
            ConnectorField("auth_domain", "Auth domain", "Domaine Auth", False, "my-app.firebaseapp.com"),
            ConnectorField("storage_bucket", "Storage bucket", "Bucket Storage", False, "my-app.appspot.com"),
            ConnectorField("messaging_sender_id", "Messaging sender ID", "Sender ID", False, "123456789"),
            ConnectorField("app_id", "App ID", "App ID", False, "1:123:web:abc"),
            ConnectorField("measurement_id", "Measurement ID", "Measurement ID", False, "G-XXXX", False),
            ConnectorField(
                "service_account_json",
                "Service account JSON",
                "JSON compte de service",
                True,
                "{ \"type\": \"service_account\", … }",
            ),
        ),
    ),
    ConnectorDefinition(
        id="resend",
        name="Resend",
        category="email",
        description_en="Modern email API for transactional messages. Without it, Forge sends via SES (25/day).",
        description_fr="API email transactionnelle. Sans compte, Forge envoie via SES (25/jour).",
        use_case_en="Send welcome emails, password resets and notifications from your app.",
        use_case_fr="Envoyez emails de bienvenue, reset mot de passe et notifications depuis votre app.",
        auth_type="api_key",
        capability="email",
        fields=(
            ConnectorField("api_key", "API key", "Clé API", True, "re_…"),
            ConnectorField("from_email", "From email", "Email expéditeur", False, "hello@example.com"),
            ConnectorField("from_name", "From name", "Nom expéditeur", False, "My app", False),
            ConnectorField("reply_to", "Reply-To", "Reply-To", False, "support@example.com", False),
            ConnectorField("webhook_secret", "Webhook secret", "Secret webhook", True, "whsec_…", False),
        ),
    ),
    ConnectorDefinition(
        id="fedapay",
        name="FedaPay",
        category="payments",
        description_en="Payment collection for mobile money and cards in Africa.",
        description_fr="Encaissement mobile money et cartes en Afrique.",
        use_case_en="Add checkout, invoices and payment webhooks to apps you ship.",
        use_case_fr="Ajoutez checkout, factures et webhooks de paiement aux apps livrées.",
        auth_type="api_key",
        capability="payment",
        fields=(
            ConnectorField("public_key", "Public key", "Clé publique", False, "pk_sandbox_…"),
            ConnectorField("secret_key", "Secret key", "Clé secrète", True, "sk_sandbox_…"),
            ConnectorField("environment", "Environment", "Environnement", False, "sandbox"),
            ConnectorField("webhook_secret", "Webhook secret", "Secret webhook", True, "", False),
            ConnectorField("currency", "Default currency", "Devise par défaut", False, "XOF", False),
        ),
    ),
    ConnectorDefinition(
        id="cloudinary",
        name="Cloudinary",
        category="media",
        description_en="Image and video hosting. Without it, Forge uses S3 with a 500 MB cap.",
        description_fr="Hébergement images/vidéos. Sans compte, Forge utilise S3 (plafond 500 Mo).",
        use_case_en="Upload avatars, product photos and media galleries in apps built with Forge.",
        use_case_fr="Ajoutez upload d’avatars, photos produits et galeries média dans vos apps Forge.",
        auth_type="api_key",
        capability="storage",
        fields=(
            ConnectorField("cloud_name", "Cloud name", "Cloud name", False, "my-app"),
            ConnectorField("api_key", "API key", "Clé API", True, "123456789012345"),
            ConnectorField("api_secret", "API secret", "Secret API", True, "abc…"),
            ConnectorField("upload_preset", "Upload preset", "Preset upload", False, "ml_default", False),
            ConnectorField("folder", "Default folder", "Dossier par défaut", False, "forge", False),
        ),
    ),
)

CONNECTOR_BY_ID = {item.id: item for item in CONNECTORS}

CATEGORY_ORDER = ("ai", "database", "auth", "email", "payments", "media")
