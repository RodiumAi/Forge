"""Detect connector capabilities required by a user prompt."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.connectors_catalog import CONNECTOR_BY_ID

_CONNECTOR_MARKER_RE = re.compile(
    r"\[Connector:\s*([a-z0-9_-]+)\s*(?:\|\s*status:(connected|missing))?\s*\]",
    re.I,
)

_ATTACH_NOISE_RE = re.compile(
    r"\[(?:Files|Fichiers|Image attached|Image jointe|Reference screenshot|Capture de référence|"
    r"PDF attached[^\]]*|PDF joint[^\]]*|Connector)[^\]]*\]|"
    r"###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte)"
    r"[^\n]*\n[\s\S]*?(?=\n###|\n\[|\Z)",
    re.I,
)


def _strip_noise(user_text: str) -> str:
    text = _ATTACH_NOISE_RE.sub(" ", user_text or "")
    text = re.sub(
        r"This is an? (?:REFERENCE screenshot(?:/mockup)?(?: for visual inspiration)?|uploaded site asset)[\s\S]*?(?=\n\n|\Z)",
        " ",
        text,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", text).strip()

# capability → regex intent
_CAPABILITY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "email",
        re.compile(
            r"\b(email|e-?mail|mail|resend|smtp|newsletter|transactional|"
            r"envoie?\s+(un\s+)?mail|envoyer\s+(un\s+)?mail|send\s+(an?\s+)?email)\b",
            re.I,
        ),
    ),
    (
        "data",
        re.compile(
            r"\b(firestore|firebase|supabase|postgres|database|base\s+de\s+donn[eé]es|"
            r"sauvegard(?:e|er)|enregistrer|store\s+in\s+(db|database)|save\s+to\s+(db|database))\b",
            re.I,
        ),
    ),
    (
        "auth",
        re.compile(
            r"\b(firebase\s+auth|sign[\s-]?in|sign[\s-]?up|login|connexion|authentification|"
            r"oauth|auth\s+google)\b",
            re.I,
        ),
    ),
    (
        "storage",
        re.compile(
            r"\b(cloudinary|upload\s+(image|photo|file|fichier)|h[eé]berg(?:er|ement)\s+"
            r"(image|photo|m[eé]dia)|image\s+hosting)\b",
            re.I,
        ),
    ),
    (
        "payment",
        re.compile(
            r"\b(fedapay|paiement|payment|checkout|mobile\s*money|stripe|factur)\b",
            re.I,
        ),
    ),
    (
        "ai",
        re.compile(
            r"\b(rodiumai|openai|llm|chatbot|assistant\s+ia|ai\s+feature|"
            r"fonctionnalit[eé]\s+ia|gpt)\b",
            re.I,
        ),
    ),
]

# Prefer these connector ids when multiple share a capability
_CAPABILITY_DEFAULTS: dict[str, str] = {
    "email": "resend",
    "data": "firebase",  # Firestore is the common ask; supabase also capability=data
    "auth": "firebase",
    "storage": "cloudinary",
    "payment": "fedapay",
    "ai": "rodiumai",
}

# Keyword overrides to a specific connector
_CONNECTOR_KEYWORD_RE = re.compile(
    r"\b(resend|firebase|firestore|supabase|cloudinary|fedapay|rodiumai)\b",
    re.I,
)

_KEYWORD_TO_CONNECTOR = {
    "resend": "resend",
    "firebase": "firebase",
    "firestore": "firebase",
    "supabase": "supabase",
    "cloudinary": "cloudinary",
    "fedapay": "fedapay",
    "rodiumai": "rodiumai",
}


@dataclass
class ConnectorRequirement:
    connector_id: str
    capability: str
    reason: str


def extract_selected_connectors(user_text: str) -> list[str]:
    ids: list[str] = []
    for match in _CONNECTOR_MARKER_RE.finditer(user_text or ""):
        cid = (match.group(1) or "").lower().strip()
        if cid in CONNECTOR_BY_ID and cid not in ids:
            ids.append(cid)
    return ids


def detect_required_connectors(prompt: str) -> list[ConnectorRequirement]:
    """Heuristic: which connectors the prompt implies."""
    text = _strip_noise(prompt or "")
    # Keep connector keywords even if strip removes markers
    raw = prompt or ""
    found: dict[str, ConnectorRequirement] = {}

    for match in _CONNECTOR_KEYWORD_RE.finditer(raw + "\n" + text):
        key = match.group(1).lower()
        cid = _KEYWORD_TO_CONNECTOR.get(key)
        if not cid or cid not in CONNECTOR_BY_ID:
            continue
        defn = CONNECTOR_BY_ID[cid]
        found[cid] = ConnectorRequirement(
            connector_id=cid,
            capability=defn.capability or defn.category,
            reason=f"mentioned:{key}",
        )

    for capability, pattern in _CAPABILITY_PATTERNS:
        if not pattern.search(text) and not pattern.search(raw):
            continue
        # If user already named a connector for this capability, keep it
        existing = next(
            (r for r in found.values() if r.capability == capability),
            None,
        )
        if existing:
            continue
        # data capability: prefer supabase if mentioned else firebase default
        if capability == "data" and "supabase" in found:
            continue
        default_id = _CAPABILITY_DEFAULTS.get(capability)
        if not default_id or default_id not in CONNECTOR_BY_ID:
            continue
        defn = CONNECTOR_BY_ID[default_id]
        found[default_id] = ConnectorRequirement(
            connector_id=default_id,
            capability=capability,
            reason=f"capability:{capability}",
        )

    return list(found.values())


def build_connector_clarify_questions(
    missing: list[ConnectorRequirement],
    locale: str = "fr",
) -> list[dict]:
    """Clarify questions pointing the user to connect missing connectors."""
    questions: list[dict] = []
    for req in missing:
        defn = CONNECTOR_BY_ID.get(req.connector_id)
        if not defn:
            continue
        name = defn.name
        if locale == "fr":
            prompt = (
                f"Pour réaliser cette demande ({req.capability}), connecte **{name}** "
                f"dans Paramètres → Connecteurs, puis renvoie le message en sélectionnant {name}."
            )
            options = [
                {"id": "goto", "label": f"Ouvrir le connecteur {name}"},
                {"id": "skip", "label": "Continuer sans backend (UI seulement)"},
                {"id": "other", "label": "J’utiliserai un autre service (précisé dans le chat)"},
            ]
        else:
            prompt = (
                f"To fulfill this request ({req.capability}), connect **{name}** "
                f"under Settings → Connectors, then resend with {name} selected."
            )
            options = [
                {"id": "goto", "label": f"Open {name} connector"},
                {"id": "skip", "label": "Continue without backend (UI only)"},
                {"id": "other", "label": "I’ll use another service (I’ll specify)"},
            ]
        questions.append(
            {
                "id": f"connector_{req.connector_id}",
                "prompt": prompt,
                "options": options,
                "connector_id": req.connector_id,
                "href": f"/connectors/{req.connector_id}",
            }
        )
    return questions


def connectors_needing_clarify(
    prompt: str,
    *,
    configured_ids: set[str],
    selected_ids: list[str] | None = None,
) -> list[ConnectorRequirement]:
    """
    Missing connectors: required by prompt OR selected as missing,
    and not configured on the account.
    """
    selected = selected_ids if selected_ids is not None else extract_selected_connectors(prompt)
    required = detect_required_connectors(prompt)
    missing: list[ConnectorRequirement] = []

    # Selected but not configured
    for cid in selected:
        if cid not in configured_ids and cid in CONNECTOR_BY_ID:
            defn = CONNECTOR_BY_ID[cid]
            missing.append(
                ConnectorRequirement(
                    connector_id=cid,
                    capability=defn.capability or defn.category,
                    reason="selected_unconfigured",
                )
            )

    # Detected by prompt but neither selected nor configured
    for req in required:
        if req.connector_id in configured_ids:
            continue
        if any(m.connector_id == req.connector_id for m in missing):
            continue
        # If user already selected a configured connector for same capability, skip
        if any(
            CONNECTOR_BY_ID.get(s)
            and (CONNECTOR_BY_ID[s].capability or CONNECTOR_BY_ID[s].category) == req.capability
            and s in configured_ids
            for s in selected
        ):
            continue
        missing.append(req)

    return missing


def resolve_active_connectors(prompt: str, configured_ids: set[str]) -> list[str]:
    """Connectors to inject as ACTIVE.

    Prefer explicit selection ∩ configured, then required ∩ configured,
    then all configured (so recipes are not ignored when heuristics miss).
    """
    selected = extract_selected_connectors(prompt)
    active: list[str] = []
    for cid in selected:
        if cid in configured_ids and cid in CONNECTOR_BY_ID and cid not in active:
            active.append(cid)
    for req in detect_required_connectors(prompt):
        cid = req.connector_id
        if cid in configured_ids and cid in CONNECTOR_BY_ID and cid not in active:
            active.append(cid)
    for cid in sorted(configured_ids):
        if cid in CONNECTOR_BY_ID and cid not in active:
            active.append(cid)
    return active
