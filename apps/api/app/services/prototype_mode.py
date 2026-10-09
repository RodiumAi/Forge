"""Frontend-only guardrails injected into the agent system prompt.

Forge Web builds client-side sites: no backend connector layer, no email
provider, no database, no payment gateway, no object-store SDK in generated
apps. Two things are provided by Forge itself instead of a backend: form
submissions (`@forge/forms`) and drop-in embeds from the integrations catalog.
"""

from __future__ import annotations

PROTOTYPE_LAYER_EN = """<prototype-mode>
Forge builds **frontend-only** sites: a static client-side bundle, no server of your own.

- Build complete, navigable UI: realistic content, localStorage for state, every state designed.
- NEVER call third-party backend APIs with secrets (email, database, payments, auth, storage).
- NEVER invent env secrets, API keys, or server routes. There is no backend to call.
- NEVER install or import backend SDKs (firebase, @supabase/supabase-js, stripe, aws-sdk…).
  They are not in the import map and will fail at runtime.
- Forms that a visitor sends (contact, quote, newsletter, booking request): validate, then
  `await submitForm("contact", data)` from "@forge/forms" and show its success/error state.
  It delivers to the site owner on the published site and resolves at once in preview.
- Cart/checkout: localStorage + mock catalog, unless the user adds a payment embed.
- Auth screens: UI only, with a mocked localStorage session.
- Third-party widgets (booking, chat, maps, video, payments) go through the integrations
  catalog embeds below: iframes as JSX, scripts injected once in a useEffect.
</prototype-mode>
"""

PROTOTYPE_LAYER_FR = """<prototype-mode>
Forge construit des sites **frontend-only** : un bundle statique côté client, sans serveur propre.

- UI complète et navigable : contenu réaliste, localStorage pour l'état, chaque état designé.
- JAMAIS d'appels vers des APIs backend tierces avec secret (email, base, paiement, auth, stockage).
- JAMAIS de secrets env, de clés API, ni de routes serveur. Il n'y a aucun backend à appeler.
- JAMAIS d'installation ni d'import de SDK backend (firebase, @supabase/supabase-js, stripe,
  aws-sdk…). Ils ne sont pas dans l'import map et échoueront au runtime.
- Formulaires envoyés par un visiteur (contact, devis, newsletter, demande de réservation) :
  valider, puis `await submitForm("contact", data)` depuis "@forge/forms" et afficher l'état
  succès/erreur. L'envoi arrive au propriétaire sur le site publié, résolu tout de suite en preview.
- Panier/checkout : localStorage + catalogue mock, sauf si l'utilisateur ajoute un embed de paiement.
- Écrans d'auth : UI seulement, avec une session mockée en localStorage.
- Widgets tiers (réservation, chat, cartes, vidéo, paiement) via les embeds du catalogue
  d'intégrations ci-dessous : iframes en JSX, scripts injectés une fois dans un useEffect.
</prototype-mode>
"""


def format_prototype_plugins_layer(*, locale: str) -> str:
    """Frontend-only rules + the preloaded plugin catalog + the embed catalog."""
    from app.plugins_catalog import format_plugins_system_block
    from app.services.integrations import format_integrations_prompt_block

    body = PROTOTYPE_LAYER_FR if locale == "fr" else PROTOTYPE_LAYER_EN
    parts = [body.strip(), format_plugins_system_block(locale)]
    embeds = format_integrations_prompt_block(locale)
    if embeds:
        parts.append(embeds)
    return "\n\n".join(parts)
