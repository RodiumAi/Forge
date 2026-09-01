"""Frontend-only prototyping guardrails injected into the agent system prompt.

Forge Web builds *client-side prototypes only*. There is no backend connector layer:
no email provider, no database, no payment gateway, no object-store SDK in generated
apps. This module owns the prompt block that states those rules to the model.
"""

from __future__ import annotations

PROTOTYPE_LAYER_EN = """<prototype-mode>
Forge is a **frontend-only prototyping** platform. Generated apps ship as a static
client-side bundle with no server of any kind.

- Build complete, navigable UI prototypes — mock data, localStorage, UI-only forms.
- NEVER call third-party backend APIs (email, database, payments, auth, storage).
- NEVER invent env secrets, API keys, or server routes. There is no backend to call.
- NEVER install or import backend SDKs (firebase, @supabase/supabase-js, stripe, aws-sdk…).
  They are not in the import map and will fail at runtime.
- Cart/checkout: localStorage + mock products. Contact forms: validate + success UI only.
- Auth screens: UI only, with a mocked in-memory/localStorage session.
- Prefer the allowed plugins: lucide-react, framer-motion (subtle), react-hook-form + zod,
  react-router-dom for multi-page, and local UI patterns.
</prototype-mode>
"""

PROTOTYPE_LAYER_FR = """<prototype-mode>
Forge est une plateforme de **prototypage frontend-only**. Les apps générées sont un
bundle statique côté client, sans serveur d'aucune sorte.

- Prototypes UI complets et navigables — données mock, localStorage, formulaires UI only.
- JAMAIS d'appels vers des APIs backend tierces (email, base de données, paiement, auth, stockage).
- JAMAIS de secrets env, de clés API, ni de routes serveur. Il n'y a aucun backend à appeler.
- JAMAIS d'installation ni d'import de SDK backend (firebase, @supabase/supabase-js, stripe,
  aws-sdk…). Ils ne sont pas dans l'import map et échoueront au runtime.
- Panier/checkout : localStorage + produits mock. Contact : validation + UI de succès seulement.
- Écrans d'auth : UI seulement, avec une session mockée en mémoire/localStorage.
- Utilise les plugins autorisés : lucide-react, framer-motion (subtil), react-hook-form + zod,
  react-router-dom pour le multi-page, et des patterns UI locaux.
</prototype-mode>
"""


def format_prototype_plugins_layer(*, locale: str) -> str:
    """Prototype-mode rules + the installable UI plugin catalog."""
    from app.plugins_catalog import format_plugins_system_block

    body = PROTOTYPE_LAYER_FR if locale == "fr" else PROTOTYPE_LAYER_EN
    plugins = format_plugins_system_block(locale, families=("icons", "animation", "forms", "ui"))
    return body.strip() + "\n\n" + plugins
