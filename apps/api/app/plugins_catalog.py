"""Forge plugin catalog — UI packages available by family for codegen.

Versions are NOT declared here: they come from ``runtime/packages.json`` via
``runtime_manifest``, so the catalog shown to the model can never drift from the
AST allowlist or the browser import map. Every installable entry is preloaded in
the import map: the model imports it directly, no package.json change needed.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.runtime_manifest import package_version


@dataclass(frozen=True)
class PluginDefinition:
    id: str
    family: str  # icons | animation | ui | forms | data | 3d | seo | i18n
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
        when_to_use_en="All UI icons (nav, actions, empty states). Never use emoji or unicode glyphs as icons.",
        when_to_use_fr="Toutes les icônes UI (nav, actions, états vides). Jamais d’emoji ni de glyphe comme icône.",
        import_example='import { ArrowRight, Menu } from "lucide-react";',
        forbidden_alternatives=("emoji icons", "unicode glyph icons", "inline SVG clutter", "font-awesome"),
    ),
    PluginDefinition(
        id="framer-motion",
        family="animation",
        package="framer-motion",
        when_to_use_en=(
            "Component motion: section reveals (whileInView), page transitions, hover/tap "
            "feedback, layout animations, staggered lists."
        ),
        when_to_use_fr=(
            "Motion de composants : révélations au scroll (whileInView), transitions de page, "
            "retours hover/tap, animations de layout, listes en cascade."
        ),
        import_example='import { motion } from "framer-motion";',
    ),
    PluginDefinition(
        id="gsap",
        family="animation",
        package="gsap",
        when_to_use_en=(
            "Timeline and scroll-driven storytelling: pinned sections, scrubbed sequences, "
            "SplitText headline reveals (every GSAP plugin is free). Pair with useGSAP() from "
            "@gsap/react so animations clean up on unmount."
        ),
        when_to_use_fr=(
            "Narration pilotée par timeline et par le scroll : sections épinglées, séquences "
            "scrubbées, titres SplitText (tous les plugins GSAP sont gratuits). Avec useGSAP() "
            "de @gsap/react pour nettoyer au démontage."
        ),
        import_example='import gsap from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger";',
    ),
    PluginDefinition(
        id="gsap-react",
        family="animation",
        package="@gsap/react",
        when_to_use_en="useGSAP() hook: scoped GSAP animations that clean up on unmount.",
        when_to_use_fr="Hook useGSAP() : animations GSAP scopées et nettoyées au démontage.",
        import_example='import { useGSAP } from "@gsap/react";',
    ),
    PluginDefinition(
        id="lenis",
        family="animation",
        package="lenis",
        when_to_use_en="Smooth inertial scrolling for editorial or portfolio sites (<ReactLenis root>).",
        when_to_use_fr="Défilement fluide inertiel pour sites éditoriaux ou portfolios (<ReactLenis root>).",
        import_example='import { ReactLenis } from "lenis/react"; import "lenis/dist/lenis.css";',
    ),
    PluginDefinition(
        id="embla",
        family="ui",
        package="embla-carousel-react",
        when_to_use_en="Lightweight carousels and sliders (testimonials, galleries, product rails).",
        when_to_use_fr="Carrousels légers (témoignages, galeries, rails produits).",
        import_example='import useEmblaCarousel from "embla-carousel-react";',
    ),
    PluginDefinition(
        id="swiper",
        family="ui",
        package="swiper",
        when_to_use_en="Feature-rich sliders (effects, thumbs, pagination); import its styles with 'swiper/css'.",
        when_to_use_fr="Sliders riches (effets, vignettes, pagination) ; importer ses styles via 'swiper/css'.",
        import_example='import { Swiper, SwiperSlide } from "swiper/react"; import "swiper/css";',
    ),
    PluginDefinition(
        id="sonner",
        family="ui",
        package="sonner",
        when_to_use_en="Toast notifications (form success, added to cart).",
        when_to_use_fr="Notifications toast (succès de formulaire, ajout au panier).",
        import_example='import { Toaster, toast } from "sonner";',
    ),
    PluginDefinition(
        id="cmdk",
        family="ui",
        package="cmdk",
        when_to_use_en="Command palettes and searchable menus (Ctrl/Cmd+K).",
        when_to_use_fr="Palettes de commandes et menus recherchables (Ctrl/Cmd+K).",
        import_example='import { Command } from "cmdk";',
    ),
    PluginDefinition(
        id="react-router",
        family="ui",
        package="react-router-dom",
        when_to_use_en=(
            "Multi-page sites. Wrap the app in <BrowserRouter> and declare <Routes> in App.tsx; "
            'one component per page under src/pages/, plus a catch-all path="*" NotFound page.'
        ),
        when_to_use_fr=(
            "Sites multi-pages. Enrober l'app dans <BrowserRouter> et déclarer les <Routes> dans "
            'App.tsx ; un composant par page dans src/pages/, plus une page NotFound en path="*".'
        ),
        import_example='import { BrowserRouter, Routes, Route, Link } from "react-router-dom";',
    ),
    PluginDefinition(
        id="shadcn-patterns",
        family="ui",
        package="shadcn",
        when_to_use_en=(
            "Accessible UI patterns (Button, Input, Card, Dialog) implemented as local "
            "components with plain CSS. Do NOT run the shadcn CLI; copy the patterns into "
            "src/components/ui/."
        ),
        when_to_use_fr=(
            "Patterns UI accessibles (Button, Input, Card, Dialog) en composants locaux "
            "avec CSS plain. PAS de CLI shadcn ; copier les patterns dans src/components/ui/."
        ),
        import_example='import { Button } from "./components/ui/Button";',
        installable=False,
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
        id="forge-forms",
        family="forms",
        package="@forge/forms",
        when_to_use_en=(
            "Real submissions for contact, quote, newsletter and booking-request forms: "
            "await submitForm(name, data) delivers to the owner's Forge inbox on the published "
            "site (it resolves immediately in preview). Show the success/error state it returns."
        ),
        when_to_use_fr=(
            "Envois réels pour les formulaires de contact, devis, newsletter et demande de "
            "réservation : await submitForm(nom, données) arrive dans la boîte Forge du "
            "propriétaire sur le site publié (résolu tout de suite en preview). Afficher l'état "
            "succès/erreur renvoyé."
        ),
        import_example='import { submitForm } from "@forge/forms";',
    ),
    PluginDefinition(
        id="recharts",
        family="data",
        package="recharts",
        when_to_use_en="Charts for dashboards and stats sections (line, bar, area, pie).",
        when_to_use_fr="Graphiques pour dashboards et sections chiffrées (ligne, barres, aires, camembert).",
        import_example='import { ResponsiveContainer, AreaChart, Area } from "recharts";',
    ),
    PluginDefinition(
        id="react-three-fiber",
        family="3d",
        package="@react-three/fiber",
        when_to_use_en=(
            "Real-time 3D scenes (hero object, product viewer) on three.js. Keep scenes light, "
            "lazy-load them, and always ship a static fallback for small screens."
        ),
        when_to_use_fr=(
            "Scènes 3D temps réel (objet hero, viewer produit) sur three.js. Scènes légères, "
            "chargées à la demande, toujours avec un repli statique sur petit écran."
        ),
        import_example='import { Canvas } from "@react-three/fiber";',
    ),
    PluginDefinition(
        id="drei",
        family="3d",
        package="@react-three/drei",
        when_to_use_en="Ready-made react-three-fiber helpers (OrbitControls, Float, Environment, Text).",
        when_to_use_fr="Helpers prêts à l’emploi pour react-three-fiber (OrbitControls, Float, Environment, Text).",
        import_example='import { Float, Environment } from "@react-three/drei";',
    ),
    PluginDefinition(
        id="three",
        family="3d",
        package="three",
        when_to_use_en="Low-level three.js (geometries, materials, addons via three/addons/...).",
        when_to_use_fr="three.js bas niveau (géométries, matériaux, addons via three/addons/...).",
        import_example='import * as THREE from "three";',
    ),
    PluginDefinition(
        id="helmet",
        family="seo",
        package="react-helmet-async",
        when_to_use_en=(
            "Per-page <title>, meta description and Open Graph tags on multi-page sites: "
            "<HelmetProvider> in main.tsx, <Helmet> in each page. Published pages are "
            "pre-rendered with these tags."
        ),
        when_to_use_fr=(
            "<title>, meta description et balises Open Graph par page sur les sites multi-pages : "
            "<HelmetProvider> dans main.tsx, <Helmet> dans chaque page. Les pages publiées sont "
            "pré-rendues avec ces balises."
        ),
        import_example='import { Helmet, HelmetProvider } from "react-helmet-async";',
    ),
    PluginDefinition(
        id="i18n",
        family="i18n",
        package="react-i18next",
        when_to_use_en=(
            "Multilingual sites: i18next + react-i18next with inline resources, a language "
            "switcher, and document.documentElement.lang kept in sync."
        ),
        when_to_use_fr=(
            "Sites multilingues : i18next + react-i18next avec ressources inline, sélecteur de "
            "langue, et document.documentElement.lang synchronisé."
        ),
        import_example='import i18n from "i18next"; import { initReactI18next, useTranslation } from "react-i18next";',
    ),
)

FAMILY_ORDER = ("icons", "animation", "ui", "forms", "data", "3d", "seo", "i18n")


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
        "Available plugins by family (preloaded in the import map, import them directly):",
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
            ver = plugin.version if plugin.installable else "(patterns only, no npm package)"
            lines.append(f"- {plugin.id}: `{plugin.package}@{ver}`: {when}")
            lines.append(f"  Example: {plugin.import_example.splitlines()[0]}")
            if plugin.forbidden_alternatives:
                lines.append("  Avoid: " + "; ".join(plugin.forbidden_alternatives))
    lines.append(
        "\nPrefer these over other libraries that do the same job. When none of them covers "
        "a need, another browser-safe npm package may be declared in package.json (see the "
        "dependency rule)."
    )
    return "\n".join(lines)
