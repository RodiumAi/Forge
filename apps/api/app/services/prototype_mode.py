"""Frontend-only guardrails injected into the agent system prompt.

Forge Web builds client-side sites: no backend connector layer, no email
provider, no database, no payment gateway, no object-store SDK in generated
apps. Forms, newsletters, bookings and analytics are drop-in embeds from the
integrations catalog, wired with the user's own account ids.
"""

from __future__ import annotations

PROTOTYPE_LAYER_EN = """<prototype-mode>
Forge builds **frontend-only** sites: a static client-side bundle, no server of your own.

- Build complete, navigable UI: realistic content, localStorage for state, every state designed.
- NEVER call third-party backend APIs with secrets (email, database, payments, auth, storage).
- NEVER invent env secrets, API keys, or server routes. There is no backend to call.
- NEVER install or import backend SDKs (firebase, @supabase/supabase-js, stripe, aws-sdk…).
  They are not in the import map and will fail at runtime.
- Forms that a visitor sends (contact, quote, newsletter, booking request) and visit analytics
  have no backend here: they are embeds from the integrations catalog below (Tally, Typeform,
  Jotform, Google Forms; Brevo, Mailchimp; Cal.com, Calendly; Plausible, Umami, Google
  Analytics), with the form or site id the user gives. Without that id, render a designed
  placeholder that names the integration to connect; never a form posting nowhere.
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
- Formulaires envoyés par un visiteur (contact, devis, newsletter, demande de réservation) et
  statistiques de visite : aucun backend ici, ce sont des embeds du catalogue d'intégrations
  ci-dessous (Tally, Typeform, Jotform, Google Forms ; Brevo, Mailchimp ; Cal.com, Calendly ;
  Plausible, Umami, Google Analytics), avec l'identifiant de formulaire ou de site fourni par
  l'utilisateur. Sans cet identifiant, afficher un emplacement designé qui nomme l'intégration
  à connecter ; jamais un formulaire qui n'envoie nulle part.
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
