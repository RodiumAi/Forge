from __future__ import annotations

from typing import Literal

from fastapi import Request

Locale = Literal["en", "fr"]

MESSAGES: dict[Locale, dict[str, str]] = {
    "en": {
        "not_authenticated": "Not authenticated",
        "invalid_token": "Invalid token",
        "user_not_found": "User not found",
        "email_taken": "Email already registered",
        "invalid_credentials": "Invalid credentials",
        "invalid_current_password": "Current password is incorrect",
        "rodium_key_short": "RodiumAi key is too short",
        "rodium_key_required": "Add your RodiumAi key in Settings before chatting.",
        "rodium_key_unreadable": "RodiumAi key is unreadable. Save it again.",
        "project_not_found": "Project not found",
        "project_deleted": "Project deleted",
        "project_name_required": "Project name or prompt is required",
        "invalid_slug": "Invalid site slug",
        "slug_taken": "This site slug is already taken",
        "template_not_found": "Unknown template",
        "chat_not_found": "Chat not found",
        "file_not_found": "File not found",
        "file_binary": "This file is not text and cannot be edited here.",
        "file_exists": "A file already exists at that path.",
        "file_conflict": "This file changed since you opened it. Reload it to see the latest version.",
        "preview_not_running": "Preview is not running. Start it from the project page.",
        "rodium_invalid_key": "Invalid or unauthorized RodiumAi key.",
        "rodium_session_expired": "RodiumAi session expired. Sign in with RodiumAi again to continue generating.",
        "rodium_quota": "Insufficient RodiumAi quota or balance.",
        "rodium_payload_too_large": "The attached image is too large to send. Try a smaller screenshot or crop the mockup.",
        "rodium_error": "RodiumAi error ({code}): {body}",
        "rodium_test_ok": "RodiumAi API key is valid.",
        "rodium_oauth_not_configured": "Sign in with RodiumAi is not configured. Set OIDC client credentials on the Forge API.",
        "rodium_oauth_required": "Sign in with RodiumAi to continue.",
        "rodium_oauth_no_password": "This account uses Sign in with RodiumAi — no local password.",
        "rodium_key_managed_oauth": "This account is linked via Sign in with RodiumAi and cannot be unlinked here.",
        "rodium_insufficient_rodi": "Insufficient RODI credits to keep generating.",
        "preview_failed": "Preview failed",
        "internal_error": "Internal error: {error}",
        "new_project": "New project",
        "main_chat": "Main",
        "step_classify": "Analyzing request",
        "step_select_files": "Selecting context",
        "step_read_attachments": "Reading attached files",
        "step_parse_image": "Parsing image",
        "step_parse_document": "Parsing document",
        "step_generate": "Generating",
        "step_generate_code": "Updating code",
        "step_generate_image": "Generating image",
        "step_apply_writes": "Writing files",
        "step_sync_deps": "Syncing dependencies",
        "step_verify_pages": "Verifying pages",
        "step_done": "Done",
        "step_plan": "Building plan",
        "step_clarify": "Clarifying",
        "effort_lite": "Fast",
        "effort_primary": "Standard",
        "effort_escalation": "Deep",
        "effort_image": "Image",
        "effort_attachments": "Attachments",
        "run_not_found": "Agent run not found",
        "run_invalid_state": "This run cannot accept that action right now.",
        "plan_empty": "Could not build a plan for this request.",
        "visual_edit_not_found": "That text was not found in the project source files.",
        "visual_edit_ambiguous": "That text appears in several places — ask Forge in chat to change it.",
        "visual_image_not_found": "That image source was not found in the project files.",
        "visual_image_ambiguous": "That image source appears in several places — pick another asset or ask chat.",
        "comment_not_found": "Comment not found",
        "visual_edit_invalid": "Invalid visual edit request.",
    },
    "fr": {
        "not_authenticated": "Non authentifié",
        "invalid_token": "Jeton invalide",
        "user_not_found": "Utilisateur introuvable",
        "email_taken": "Email déjà enregistré",
        "invalid_credentials": "Identifiants invalides",
        "invalid_current_password": "Mot de passe actuel incorrect",
        "rodium_key_short": "Clé RodiumAi trop courte",
        "rodium_key_required": "Ajoutez votre clé RodiumAi dans Réglages avant de chatter.",
        "rodium_key_unreadable": "Clé RodiumAi illisible. Enregistrez-la à nouveau.",
        "project_not_found": "Projet introuvable",
        "project_deleted": "Projet supprimé",
        "project_name_required": "Nom du projet ou prompt requis",
        "invalid_slug": "Identifiant de site invalide",
        "slug_taken": "Cet identifiant de site est déjà pris",
        "template_not_found": "Template inconnu",
        "chat_not_found": "Chat introuvable",
        "file_not_found": "Fichier introuvable",
        "file_binary": "Ce fichier n'est pas du texte et ne peut pas être édité ici.",
        "file_exists": "Un fichier existe déjà à ce chemin.",
        "file_conflict": "Ce fichier a changé depuis son ouverture. Rechargez-le pour voir la dernière version.",
        "preview_not_running": "Preview inactive. Lancez-la depuis la page projet.",
        "rodium_invalid_key": "Clé RodiumAi invalide ou non autorisée.",
        "rodium_session_expired": "Session RodiumAi expirée. Reconnectez-vous avec RodiumAi pour continuer la génération.",
        "rodium_quota": "Quota ou solde RodiumAi insuffisant.",
        "rodium_payload_too_large": "L'image jointe est trop volumineuse. Utilisez une capture plus petite ou recadrez le mockup.",
        "rodium_error": "Erreur RodiumAi ({code}) : {body}",
        "rodium_test_ok": "La clé API RodiumAi est valide.",
        "rodium_oauth_not_configured": "Connexion RodiumAi non configurée. Définissez les credentials OIDC sur l’API Forge.",
        "rodium_oauth_required": "Connectez-vous avec RodiumAi pour continuer.",
        "rodium_oauth_no_password": "Ce compte utilise « Se connecter avec RodiumAi » — pas de mot de passe local.",
        "rodium_key_managed_oauth": "Ce compte est lié via « Se connecter avec RodiumAi » et ne peut pas être délié ici.",
        "rodium_insufficient_rodi": "Crédits RODI insuffisants pour continuer à générer.",
        "preview_failed": "Échec de la preview",
        "internal_error": "Erreur interne : {error}",
        "new_project": "Nouveau projet",
        "main_chat": "Principal",
        "step_classify": "Analyse de la demande",
        "step_select_files": "Sélection du contexte",
        "step_read_attachments": "Lecture des fichiers joints",
        "step_parse_image": "Analyse de l'image",
        "step_parse_document": "Lecture du document",
        "step_generate": "Génération",
        "step_generate_code": "Mise à jour du code",
        "step_generate_image": "Génération de l'image",
        "step_apply_writes": "Écriture des fichiers",
        "step_sync_deps": "Synchronisation des dépendances",
        "step_verify_pages": "Vérification des pages",
        "step_done": "Terminé",
        "step_plan": "Construction du plan",
        "step_clarify": "Clarification",
        "effort_lite": "Rapide",
        "effort_primary": "Standard",
        "effort_escalation": "Approfondi",
        "effort_image": "Image",
        "effort_attachments": "Pièces jointes",
        "run_not_found": "Exécution introuvable",
        "run_invalid_state": "Cette exécution ne peut pas accepter cette action.",
        "plan_empty": "Impossible de construire un plan pour cette demande.",
        "visual_edit_not_found": "Ce texte est introuvable dans les fichiers source du projet.",
        "visual_edit_ambiguous": "Ce texte apparaît à plusieurs endroits — demandez à Forge dans le chat de le modifier.",
        "visual_image_not_found": "Cette source d’image est introuvable dans les fichiers du projet.",
        "visual_image_ambiguous": "Cette source d’image apparaît à plusieurs endroits — choisissez un autre fichier ou passez par le chat.",
        "comment_not_found": "Commentaire introuvable",
        "visual_edit_invalid": "Modification visuelle invalide.",
    },
}


def resolve_locale(request: Request | None = None, header: str | None = None) -> Locale:
    raw = header
    if request is not None:
        raw = request.headers.get("accept-language") or raw
    if not raw:
        return "fr"
    primary = raw.split(",")[0].strip().lower()
    if primary.startswith("en"):
        return "en"
    return "fr"


def t(key: str, locale: Locale = "fr", **kwargs: object) -> str:
    template = MESSAGES.get(locale, MESSAGES["fr"]).get(key) or MESSAGES["en"].get(key) or key
    if kwargs:
        try:
            return template.format(**kwargs)
        except Exception:
            return template
    return template
