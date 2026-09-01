"""Forge plugin catalog — UI packages available by family for codegen.

Versions are NOT declared here: they come from ``runtime/packages.json`` via
``runtime_manifest``, so the catalog shown to the model can never drift from the
AST allowlist or the browser import map.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.runtime_manifest import package_version


@dataclass(frozen=True)
class PluginDefinition:
    id: str
    family: str  # icons | animation | forms | ui
    package: str
    when_to_use_en: str
    when_to_use_fr: str
    import_example: str
    forbidden_alternatives: tuple[str, ...] = ()
    # If True, package goes in dependencies; else patterns-only (no npm install).
    installable: bool = True

    @property
    def version(self) -> str | None:
        """Pin from the shared manifest, or None for patterns-only plugins."""
        if not self.installable:
            return None
        return package_version(self.package)


PLUGINS: tuple[PluginDefinition, ...] = (
    PluginDefinition(
        id="lucide",
        family="icons",
        package="lucide-react",
        when_to_use_en="All UI icons (nav, actions, empty states). Never use emoji as icons.",
        when_to_use_fr="Toutes les icônes UI (nav, actions, états vides). Jamais d’emoji comme icône.",
        import_example='import { ArrowRight, Menu } from "lucide-react";',
        forbidden_alternatives=("emoji icons", "inline SVG clutter", "font-awesome"),
    ),
    PluginDefinition(
        id="framer-motion",
        family="animation",
        package="framer-motion",
        when_to_use_en="Page transitions, section reveals, micro-interactions. Prefer subtle motion.",
        when_to_use_fr="Transitions de page, révélations de sections, micro-interactions. Motion subtil.",
        import_example='import { motion } from "framer-motion";',
        forbidden_alternatives=("css-only hacks for complex sequences",),
    ),
    PluginDefinition(
        id="react-hook-form",
        family="forms",
        package="react-hook-form",
        when_to_use_en="Contact forms, multi-field forms, validation UX.",
        when_to_use_fr="Formulaires de contact, formulaires multi-champs, UX de validation.",
        import_example='import { useForm } from "react-hook-form";',
    ),
    PluginDefinition(
        id="zod",
        family="forms",
        package="zod",
        when_to_use_en="Schema validation with react-hook-form (@hookform/resolvers/zod).",
        when_to_use_fr="Validation de schéma avec react-hook-form (@hookform/resolvers/zod).",
        import_example='import { z } from "zod";',
    ),
    PluginDefinition(
        id="hookform-resolvers",
        family="forms",
        package="@hookform/resolvers",
        when_to_use_en="Bridge zod schemas into react-hook-form.",
        when_to_use_fr="Brancher les schémas zod sur react-hook-form.",
        import_example='import { zodResolver } from "@hookform/resolvers/zod";',
    ),
    PluginDefinition(
        id="shadcn-patterns",
        family="ui",
        package="shadcn",
        when_to_use_en=(
            "Accessible UI patterns (Button, Input, Card, Dialog) implemented as local "
            "components with plain CSS — do NOT run shadcn CLI; copy patterns into src/components/ui/."
        ),
        when_to_use_fr=(
            "Patterns UI accessibles (Button, Input, Card, Dialog) en composants locaux "
            "avec CSS plain — PAS de CLI shadcn ; copier les patterns dans src/components/ui/."
        ),
        import_example='import { Button } from "./components/ui/Button";',
        installable=False,
    ),
    PluginDefinition(
        id="react-router",
        family="ui",
        package="react-router-dom",
        when_to_use_en=(
            "Multi-page prototypes. Wrap the app in <BrowserRouter> and declare <Routes> "
            "in App.tsx; put one component per page under src/pages/."
        ),
        when_to_use_fr=(
            "Prototypes multi-pages. Enrober l'app dans <BrowserRouter> et déclarer les "
            "<Routes> dans App.tsx ; un composant par page dans src/pages/."
        ),
        import_example='import { BrowserRouter, Routes, Route, Link } from "react-router-dom";',
    ),
)

FAMILY_ORDER = ("icons", "animation", "forms", "ui")


PLUGIN_BY_ID = {p.id: p for p in PLUGINS}
PLUGIN_BY_PACKAGE = {p.package: p for p in PLUGINS if p.installable}


def catalog_package_versions() -> dict[str, str]:
    """package → version for installable plugins (used by preview sync)."""
    return {p.package: p.version for p in PLUGINS if p.installable}


def format_plugins_system_block(
    locale: str = "en",
    *,
    families: tuple[str, ...] | None = None,
) -> str:
    """LLM-facing catalog summary. Optionally restrict to given families."""
    allowed = set(families) if families else None
    lines = [
        "Available plugins by family (prefer these; pin exact versions in package.json):",
    ]
    by_family: dict[str, list[PluginDefinition]] = {}
    for plugin in PLUGINS:
        if allowed is not None and plugin.family not in allowed:
            continue
        by_family.setdefault(plugin.family, []).append(plugin)

    for family in FAMILY_ORDER:
        items = by_family.get(family) or []
        if not items:
            continue
        lines.append(f"\n## {family}")
        for plugin in items:
            when = plugin.when_to_use_fr if locale == "fr" else plugin.when_to_use_en
            ver = plugin.version if plugin.installable else "(patterns only — no npm package)"
            lines.append(f"- {plugin.id}: `{plugin.package}@{ver}` — {when}")
            lines.append(f"  Example: {plugin.import_example.splitlines()[0]}")
            if plugin.forbidden_alternatives:
                lines.append("  Avoid: " + "; ".join(plugin.forbidden_alternatives))
    lines.append(
        "\nIf you add an installable plugin, update package.json with the catalog version "
        "and import it. Do not invent alternate icon/animation/form libraries."
    )
    return "\n".join(lines)
