"""Codegen recipes for Forge connectors — critical-rules + env placeholders, no secrets."""

from __future__ import annotations

from dataclasses import dataclass

from app.connectors_catalog import CONNECTOR_BY_ID, CONNECTORS
from app.plugins_catalog import format_plugins_system_block

CRITICAL_RULES = """<critical-rules>
These rules MUST be followed at all times. Violation is a hard failure.

- **no-secrets-in-client**: NEVER hardcode API keys, service accounts, private keys, or webhook secrets
  in TSX/TS/JS that ships to the browser. Use `.env.example` placeholders only.
- **no-direct-admin-tier**: NEVER call third-party admin/secret APIs (service_role, secret_key,
  private Resend/FedaPay keys, etc.) directly from generated client code. Prefer documented
  connector patterns: public/anon client SDK, unsigned upload preset, or a server/gateway path.
- **deny-by-default**: If a connector is not listed ACTIVE below, do not invent backend wiring;
  build UI only and ask the user to connect the matching connector.
- **env-only-credentials**: Document required env keys; never paste real credential values.
</critical-rules>
"""


@dataclass(frozen=True)
class ConnectorRecipe:
    connector_id: str
    env_keys: tuple[str, ...]
    recipe_en: str
    recipe_fr: str


RECIPES: tuple[ConnectorRecipe, ...] = (
    ConnectorRecipe(
        connector_id="resend",
        env_keys=("RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_FROM_NAME"),
        recipe_en=(
            "Email (Resend) — ACTIVE:\n"
            "- Add `.env.example` with RESEND_API_KEY, RESEND_FROM_EMAIL (never real keys).\n"
            "- Pattern: contact form UI → POST payload to a documented server/gateway handler "
            "(e.g. `src/lib/contactApi.ts` calling your backend). Do NOT put RESEND_API_KEY in "
            "`VITE_*` or browser code.\n"
            "- For Vite SPA without a server yet: wire the form + typed payload; document that "
            "production needs a serverless/API route that calls Resend REST with the secret.\n"
            "- Prefer react-hook-form + zod when forms are involved.\n"
            "- Do NOT fake success without a real send path when Resend is ACTIVE."
        ),
        recipe_fr=(
            "Email (Resend) — ACTIF:\n"
            "- `.env.example` avec RESEND_API_KEY, RESEND_FROM_EMAIL (jamais de vraies clés).\n"
            "- Pattern: UI formulaire → POST vers un handler serveur/gateway documenté "
            "(ex. `src/lib/contactApi.ts`). Ne JAMAIS mettre RESEND_API_KEY en `VITE_*`.\n"
            "- SPA Vite sans serveur: brancher UI + payload typé; documenter une route API "
            "qui appelle Resend avec le secret.\n"
            "- Préférer react-hook-form + zod.\n"
            "- Ne PAS simuler un succès sans vrai chemin d’envoi si Resend est ACTIF."
        ),
    ),
    ConnectorRecipe(
        connector_id="firebase",
        env_keys=(
            "VITE_FIREBASE_API_KEY",
            "VITE_FIREBASE_AUTH_DOMAIN",
            "VITE_FIREBASE_PROJECT_ID",
            "VITE_FIREBASE_STORAGE_BUCKET",
            "VITE_FIREBASE_MESSAGING_SENDER_ID",
            "VITE_FIREBASE_APP_ID",
        ),
        recipe_en=(
            "Firebase / Firestore — ACTIVE:\n"
            "- Package `firebase` + `src/lib/firebase.ts` from `import.meta.env.VITE_FIREBASE_*`.\n"
            "- Client may use the Firebase web config (apiKey is expected public); NEVER embed "
            "service_account JSON or Admin SDK credentials.\n"
            "- Writes: `collection` + `addDoc` with typed fields; Auth only if requested.\n"
            "- Mention Firestore security rules (deny-by-default) in a short comment/README."
        ),
        recipe_fr=(
            "Firebase / Firestore — ACTIF:\n"
            "- Package `firebase` + `src/lib/firebase.ts` via `import.meta.env.VITE_FIREBASE_*`.\n"
            "- Config web Firebase OK côté client; JAMAIS de service_account / Admin SDK.\n"
            "- Écritures: `collection` + `addDoc` typé; Auth seulement si demandé.\n"
            "- Mentionner règles Firestore (deny-by-default) en commentaire/README."
        ),
    ),
    ConnectorRecipe(
        connector_id="supabase",
        env_keys=("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"),
        recipe_en=(
            "Supabase — ACTIVE:\n"
            "- `@supabase/supabase-js` + `src/lib/supabase.ts` from VITE_SUPABASE_URL / ANON_KEY.\n"
            "- Client uses anon key only. NEVER put `service_role` in the browser.\n"
            "- Inserts via `.from('table').insert(...)`. Rely on RLS; document required tables."
        ),
        recipe_fr=(
            "Supabase — ACTIF:\n"
            "- `@supabase/supabase-js` + `src/lib/supabase.ts` via URL / ANON_KEY.\n"
            "- Clé anon uniquement. JAMAIS `service_role` dans le navigateur.\n"
            "- Inserts `.from('table').insert(...)`. Compter sur RLS; documenter les tables."
        ),
    ),
    ConnectorRecipe(
        connector_id="cloudinary",
        env_keys=("VITE_CLOUDINARY_CLOUD_NAME", "VITE_CLOUDINARY_UPLOAD_PRESET"),
        recipe_en=(
            "Cloudinary — ACTIVE:\n"
            "- Unsigned upload preset from env for browser uploads, OR document signed upload "
            "via a backend (never put API secret in client).\n"
            "- File input → upload → store returned `secure_url` in UI state / DB."
        ),
        recipe_fr=(
            "Cloudinary — ACTIF:\n"
            "- Preset unsigned via env pour uploads navigateur, OU upload signé via backend "
            "(jamais de secret API côté client).\n"
            "- Input fichier → upload → stocker `secure_url` dans l’UI / DB."
        ),
    ),
    ConnectorRecipe(
        connector_id="fedapay",
        env_keys=("VITE_FEDAPAY_PUBLIC_KEY", "FEDAPAY_SECRET_KEY", "FEDAPAY_ENVIRONMENT"),
        recipe_en=(
            "FedaPay — ACTIVE:\n"
            "- Checkout UI with public key only (`VITE_FEDAPAY_PUBLIC_KEY`).\n"
            "- SECRET key and webhooks stay server-side; document a stub gateway path.\n"
            "- Never expose `FEDAPAY_SECRET_KEY` in client bundles."
        ),
        recipe_fr=(
            "FedaPay — ACTIF:\n"
            "- UI checkout avec clé publique uniquement (`VITE_FEDAPAY_PUBLIC_KEY`).\n"
            "- Clé secrète + webhooks côté serveur; documenter un stub gateway.\n"
            "- Ne jamais exposer `FEDAPAY_SECRET_KEY` dans le bundle client."
        ),
    ),
    ConnectorRecipe(
        connector_id="rodiumai",
        env_keys=("VITE_RODIUMAI_API_KEY", "VITE_RODIUMAI_BASE_URL"),
        recipe_en=(
            "RodiumAi (OpenAI-compatible) — ACTIVE:\n"
            "- Prefer calling via a thin server/gateway when possible; if using browser SDK, "
            "treat the key as user-scoped and never commit real keys.\n"
            "- `openai` package with baseURL = RodiumAi API + env placeholders.\n"
            "- Chat/completion UI only when the user asked for an AI product feature."
        ),
        recipe_fr=(
            "RodiumAi (compatible OpenAI) — ACTIF:\n"
            "- Préférer un gateway serveur; si SDK navigateur, clé user-scoped, jamais commitée.\n"
            "- Package `openai` avec baseURL RodiumAi + placeholders env.\n"
            "- UI chat seulement si l’utilisateur demande une feature IA."
        ),
    ),
)

RECIPE_BY_ID = {r.connector_id: r for r in RECIPES}


def format_connectors_system_block(
    *,
    locale: str,
    selected_ids: list[str],
    configured_ids: list[str],
) -> str:
    """LLM layer for active connectors + recipes (no secrets).

    Configured connectors are treated as ACTIVE (even without heuristic detection)
    so the model does not ignore available backends.
    """
    active: list[str] = []
    for cid in selected_ids:
        if cid in CONNECTOR_BY_ID and cid not in active:
            active.append(cid)
    for cid in configured_ids:
        if cid in CONNECTOR_BY_ID and cid not in active:
            active.append(cid)

    lines = [
        CRITICAL_RULES.strip(),
        "",
        "Connectors for this turn:",
        "- If a connector is listed as ACTIVE below, implement real wiring (env + lib pattern).",
        "- Never invent fake backends when a matching connector is ACTIVE.",
        "- Never hardcode API keys; use .env.example + import.meta.env / process.env placeholders.",
        "- Sites must not speak to third-party admin APIs with secrets from the browser.",
        "",
        f"Configured on account: {', '.join(configured_ids) or '(none)'}",
        f"ACTIVE for this request: {', '.join(active) or '(none)'}",
    ]
    for cid in active:
        defn = CONNECTOR_BY_ID.get(cid)
        recipe = RECIPE_BY_ID.get(cid)
        if not defn:
            continue
        lines.append(f"\n### {defn.name} (`{cid}`)")
        use = defn.use_case_fr if locale == "fr" else defn.use_case_en
        lines.append(f"Use case: {use}")
        if recipe:
            body = recipe.recipe_fr if locale == "fr" else recipe.recipe_en
            lines.append(body)
            lines.append("Env keys: " + ", ".join(recipe.env_keys))
    if not active:
        lines.append(
            "\nNo connector ACTIVE — build UI only unless the user explicitly asks for a "
            "backend; then request the matching connector."
        )
    return "\n".join(lines)


def format_plugins_and_connectors_layer(
    *,
    locale: str,
    selected_connector_ids: list[str],
    configured_connector_ids: list[str],
) -> str:
    return (
        format_plugins_system_block(locale)
        + "\n\n"
        + format_connectors_system_block(
            locale=locale,
            selected_ids=selected_connector_ids,
            configured_ids=configured_connector_ids,
        )
    )


PROTOTYPE_LAYER_EN = """<prototype-mode>
Forge is a **frontend-only prototyping** platform for this project.

- Build complete, navigable UI prototypes — mock data, localStorage, UI-only forms.
- NEVER call third-party backend APIs (Resend, Firebase Admin, Stripe secrets, etc.).
- NEVER invent connector wiring, env secrets, or server routes for email/DB/payments.
- Cart/checkout: localStorage + mock products. Contact forms: validate + success UI only.
- Prefer plugins: lucide-react, framer-motion (subtle), react-hook-form + zod, local UI patterns.
- Do NOT install firebase / @supabase/supabase-js unless the user explicitly asks for a
  client-side demo that stays mockable without real credentials.
</prototype-mode>
"""

PROTOTYPE_LAYER_FR = """<prototype-mode>
Forge est une plateforme de **prototypage frontend-only** pour ce projet.

- Prototypes UI complets et navigables — données mock, localStorage, formulaires UI only.
- JAMAIS d’appels APIs backend tierces (Resend, Firebase Admin, secrets Stripe, etc.).
- JAMAIS de wiring connecteur, secrets env, ou routes serveur pour email/DB/paiements.
- Panier/checkout: localStorage + produits mock. Contact: validation + UI succès seulement.
- Plugins: lucide-react, framer-motion (subtil), react-hook-form + zod, patterns UI locaux.
- N’installe PAS firebase / @supabase/supabase-js sauf demande explicite d’une démo client
  mockable sans vrais credentials.
</prototype-mode>
"""


def format_prototype_plugins_layer(*, locale: str) -> str:
    """UI plugins only — no backend connector recipes (prototype mode)."""
    from app.plugins_catalog import format_plugins_system_block as _plugins

    body = PROTOTYPE_LAYER_FR if locale == "fr" else PROTOTYPE_LAYER_EN
    return body.strip() + "\n\n" + _plugins(locale, families=("icons", "animation", "forms", "ui"))


def list_connector_ids() -> list[str]:
    return [c.id for c in CONNECTORS]
