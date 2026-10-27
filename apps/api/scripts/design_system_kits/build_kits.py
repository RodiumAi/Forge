"""Build the six design system starter kits in ``data/templates/design-system-*``.

Each kit is written from a compact spec through the same code as the AI flow
(``tokens.build_document``), so a kit is always a valid, contrast-checked
design system. Run from ``apps/api``:

    .venv/Scripts/python.exe scripts/design_system_kits/build_kits.py

Files per kit: ``template.json`` (catalogue entry), ``design-system.json``,
``DESIGN.md``, the brand files in ``public/brand/`` (``logo.svg`` for light
grounds, ``logo-dark.svg`` for dark grounds, ``icon.svg``), ``preview.html``
(the brand guidelines page with its assets inlined) and ``preview.png`` (the
gallery card: the guidelines cover with the colour and type pages, rendered
here with Playwright).

The brand files come from ``brands/<id>/``. They were drawn by
``draw_brandmarks.py`` (geometric icon, wordmark outlined from the display font),
so they render the same everywhere, without a web font.
"""

from __future__ import annotations

import base64
import json
import shutil
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.design_system.color import best_text_on, contrast_ratio
from app.services.design_system.render import design_md
from app.services.design_system.site import brand_site_html
from app.services.design_system.tokens import (
    LOGO_PATH,
    Spec,
    build_document,
    colors_of,
    font_families,
    google_fonts_url,
)

ROOT = Path(__file__).resolve().parents[4] / "data" / "templates"
BRANDS = Path(__file__).resolve().parent / "brands"
LOGO_DARK_PATH = "public/brand/logo-dark.svg"
ICON_PATH = "public/brand/icon.svg"

KITS: list[dict] = [
    {
        "id": "design-system-saas",
        "title": {"fr": "SaaS sobre", "en": "Sober SaaS"},
        "description": {
            "fr": "Design system clair et précis pour un logiciel B2B : blanc, gris ardoise, un bleu franc, Inter partout.",
            "en": "Clear, precise design system for B2B software: white, slate greys, a frank blue, Inter everywhere.",
        },
        "tags": ["saas", "b2b", "minimal", "light"],
        "tone": "clear, precise, reassuring",
        "spec": {
            "name": "Ardoise",
            "description": "Logiciel B2B de gestion de projets pour équipes produit. Clair, précis, rassurant.",
            "colors": {
                "bg": "#ffffff",
                "surface": "#f8fafc",
                "fg": "#0f172a",
                "muted": "#475569",
                "accent": "#2563eb",
                "secondary": "#0ea5e9",
                "border": "#e2e8f0",
                "success": "#15803d",
                "warning": "#b45309",
                "danger": "#b91c1c",
                "info": "#1d4ed8",
            },
            "fonts": {"display": "Inter", "body": "Inter", "mono": "JetBrains Mono"},
            "type": {"base": 16, "ratio": 1.2},
            "space": 8,
            "radius": {"sm": 6, "md": 8, "lg": 12},
            "shadow": "soft",
            "motion": "snappy",
            "logo": {
                "clearSpace": "La hauteur du symbole tout autour du logo",
                "minSizePx": 24,
                "usage": ["Sur fond blanc ou ardoise très clair", "Version blanche sur le bleu d'accent"],
                "misuse": [
                    "Déformer ou incliner le logo",
                    "Ajouter une ombre ou un dégradé",
                    "Le poser sur une photo chargée",
                ],
            },
            "iconography": {
                "library": "lucide",
                "style": "outline",
                "stroke": 1.75,
                "summary": "Icônes au trait fin, toujours accompagnées d'un libellé dans la navigation.",
                "do": ["Une seule taille par zone", "Couleur du texte, accent seulement pour l'état actif"],
                "dont": ["Mélanger icônes pleines et au trait", "Icônes décoratives sans fonction"],
            },
            "imagery": {
                "summary": "Captures d'interface nettes et illustrations géométriques sobres.",
                "do": ["Captures réelles du produit", "Fonds clairs et beaucoup d'air"],
                "dont": ["Photos de banque d'images génériques", "Mockups 3D surchargés"],
            },
            "voice": {
                "summary": "Direct, concret, sans jargon. On parle de résultats.",
                "do": ["Phrases courtes à l'actif", "Verbes d'action sur les boutons", "Chiffres précis"],
                "dont": ["Superlatifs creux", "Jargon technique non expliqué", "Points d'exclamation"],
            },
            "guidelines": {
                "summary": "La clarté avant l'effet : une action principale par écran.",
                "do": [
                    "Un seul bouton principal visible",
                    "Aligner sur la grille de 8 px",
                    "Contraste AA pour tout texte",
                ],
                "dont": [
                    "Plus de deux couleurs d'accent",
                    "Texte gris clair sur fond blanc",
                    "Animations de plus de 300 ms",
                ],
            },
        },
    },
    {
        "id": "design-system-fintech",
        "title": {"fr": "Fintech", "en": "Fintech"},
        "description": {
            "fr": "Design system sombre et digne de confiance pour une néobanque : bleu nuit, vert émeraude, Manrope et chiffres en mono.",
            "en": "Dark, trustworthy design system for a neobank: midnight blue, emerald green, Manrope and mono figures.",
        },
        "tags": ["fintech", "bank", "dark", "trust"],
        "tone": "trustworthy, modern, calm",
        "spec": {
            "name": "Nuvia",
            "description": "Néobanque mobile pour les indépendants d'Afrique de l'Ouest. Sûre, moderne, sereine.",
            "colors": {
                "bg": "#0b1220",
                "surface": "#131c2e",
                "fg": "#e8eef8",
                "muted": "#94a3b8",
                "accent": "#10b981",
                "secondary": "#38bdf8",
                "border": "#22304a",
                "success": "#34d399",
                "warning": "#fbbf24",
                "danger": "#f87171",
                "info": "#60a5fa",
            },
            "fonts": {"display": "Manrope", "body": "Manrope", "mono": "IBM Plex Mono"},
            "type": {"base": 16, "ratio": 1.25},
            "space": 8,
            "radius": {"sm": 8, "md": 12, "lg": 20},
            "shadow": "medium",
            "motion": "balanced",
            "logo": {
                "clearSpace": "La moitié de la hauteur du logo",
                "minSizePx": 28,
                "usage": ["Version claire sur le bleu nuit", "Symbole seul pour l'icône d'application"],
                "misuse": [
                    "Changer la couleur émeraude",
                    "Placer le logo sur un fond rouge",
                    "Animer le logo",
                ],
            },
            "iconography": {
                "library": "lucide",
                "style": "outline",
                "stroke": 2,
                "summary": "Icônes nettes et lisibles, l'émeraude réservée aux actions positives.",
                "do": ["Flèches pour les flux d'argent", "Cadenas pour la sécurité"],
                "dont": ["Icônes de pièces ou de billets clichés", "Rouge hors des alertes"],
            },
            "imagery": {
                "summary": "Portraits d'entrepreneurs en lumière naturelle, couleurs désaturées.",
                "do": ["Vraies personnes au travail", "Cadrages serrés et sereins"],
                "dont": ["Billets et pièces en gros plan", "Graphiques boursiers décoratifs"],
            },
            "voice": {
                "summary": "Rassurant et transparent. Chaque frais est annoncé avant l'action.",
                "do": [
                    "Montants exacts avec la devise",
                    "Expliquer ce qui va se passer",
                    "Tutoyer avec respect",
                ],
                "dont": ["Promesses de gains", "Petites lignes cachées", "Urgence artificielle"],
            },
            "guidelines": {
                "summary": "La confiance se lit dans la constance : mêmes composants, mêmes mots.",
                "do": [
                    "Chiffres en police mono alignés à droite",
                    "Confirmer chaque transfert",
                    "Contraste AA partout",
                ],
                "dont": [
                    "Vert pour autre chose qu'un succès",
                    "Tableaux sans séparateurs",
                    "Texte sous 14 px",
                ],
            },
        },
    },
    {
        "id": "design-system-sante",
        "title": {"fr": "Santé", "en": "Health"},
        "description": {
            "fr": "Design system apaisant et très lisible pour un service de santé : sarcelle, fond crème, Lexend et Nunito Sans.",
            "en": "Soothing, highly readable design system for a health service: teal, cream background, Lexend and Nunito Sans.",
        },
        "tags": ["health", "care", "accessible", "light"],
        "tone": "caring, clear, accessible",
        "spec": {
            "name": "Soina",
            "description": "Téléconsultation et suivi de santé pour les familles. Bienveillant, clair, accessible.",
            "colors": {
                "bg": "#fbfaf6",
                "surface": "#ffffff",
                "fg": "#16302b",
                "muted": "#4b635d",
                "accent": "#0f766e",
                "secondary": "#7c9a3d",
                "border": "#dfe7e3",
                "success": "#15803d",
                "warning": "#a16207",
                "danger": "#b42318",
                "info": "#1e6091",
            },
            "fonts": {"display": "Lexend", "body": "Nunito Sans", "mono": "IBM Plex Mono"},
            "type": {"base": 18, "ratio": 1.2},
            "space": 8,
            "radius": {"sm": 8, "md": 12, "lg": 20},
            "shadow": "soft",
            "motion": "calm",
            "logo": {
                "clearSpace": "La hauteur des deux feuilles tout autour",
                "minSizePx": 32,
                "usage": ["Sur fond crème ou blanc", "Version blanche sur la sarcelle"],
                "misuse": [
                    "Utiliser une croix médicale à côté du logo",
                    "Recolorer en rouge",
                    "Réduire sous 32 px",
                ],
            },
            "iconography": {
                "library": "lucide",
                "style": "outline",
                "stroke": 2,
                "summary": "Icônes rondes et douces, toujours avec un libellé.",
                "do": ["Libellé sous chaque icône d'action", "Grandes zones de toucher (44 px)"],
                "dont": ["Icônes anatomiques réalistes", "Seringues ou sang"],
            },
            "imagery": {
                "summary": "Moments du quotidien, lumière douce, personnes de tous âges.",
                "do": ["Familles et soignants en situation réelle", "Couleurs chaudes et naturelles"],
                "dont": ["Blouses blanches posées en studio", "Images médicales anxiogènes"],
            },
            "voice": {
                "summary": "Bienveillant et précis. On rassure sans minimiser.",
                "do": ["Mots simples, phrases courtes", "Dire quoi faire ensuite", "Vouvoyer"],
                "dont": ["Jargon médical non expliqué", "Humour sur les symptômes", "Promesses de guérison"],
            },
            "guidelines": {
                "summary": "Accessibilité d'abord : texte 18 px, contraste AAA quand c'est possible.",
                "do": [
                    "Texte de base à 18 px",
                    "Contraste AAA pour le texte courant",
                    "Une seule tâche par écran",
                ],
                "dont": [
                    "Couleur comme seul signal",
                    "Délais courts sur les messages",
                    "Formulaires de plus de 5 champs",
                ],
            },
        },
    },
    {
        "id": "design-system-education",
        "title": {"fr": "Éducation", "en": "Education"},
        "description": {
            "fr": "Design system chaleureux et encourageant pour l'apprentissage : orange, bleu profond, Fredoka et Nunito.",
            "en": "Warm, encouraging design system for learning: orange, deep blue, Fredoka and Nunito.",
        },
        "tags": ["education", "learning", "friendly", "light"],
        "tone": "warm, encouraging, playful",
        "spec": {
            "name": "Kalo",
            "description": "Plateforme de soutien scolaire pour collégiens. Chaleureuse, encourageante, ludique.",
            "colors": {
                "bg": "#fffaf3",
                "surface": "#ffffff",
                "fg": "#1f2a44",
                "muted": "#55607a",
                "accent": "#c2410c",
                "secondary": "#1d4ed8",
                "border": "#f0e4d4",
                "success": "#15803d",
                "warning": "#a16207",
                "danger": "#b91c1c",
                "info": "#1d4ed8",
            },
            "fonts": {"display": "Fredoka", "body": "Nunito", "mono": "Space Mono"},
            "type": {"base": 17, "ratio": 1.25},
            "space": 8,
            "radius": {"sm": 10, "md": 14, "lg": 24},
            "shadow": "soft",
            "motion": "snappy",
            "logo": {
                "clearSpace": "La moitié de la hauteur du logo",
                "minSizePx": 28,
                "usage": ["Couleur sur fond clair", "Blanc sur l'orange pour les badges"],
                "misuse": [
                    "Ajouter des yeux ou une mascotte au logo",
                    "Contour épais autour",
                    "Plus de deux couleurs",
                ],
            },
            "iconography": {
                "library": "lucide",
                "style": "duotone",
                "stroke": 2,
                "summary": "Icônes généreuses, l'accent souligne la progression.",
                "do": ["Étoiles et badges pour les réussites", "Icônes de matière cohérentes"],
                "dont": ["Icônes punitives (croix rouges en série)", "Pictogrammes trop détaillés"],
            },
            "imagery": {
                "summary": "Illustrations colorées et rondes, élèves variés et souriants.",
                "do": ["Illustrations plates aux formes rondes", "Scènes de classe et de maison"],
                "dont": ["Photos de manuels scolaires", "Clichés de génie en blouse"],
            },
            "voice": {
                "summary": "Encourageant et concret. L'erreur est une étape.",
                "do": ["Féliciter l'effort", "Consignes en une phrase", "Tutoyer"],
                "dont": [
                    "Ironie",
                    "Comparer les élèves entre eux",
                    "Mots de plus de trois syllabes sans besoin",
                ],
            },
            "guidelines": {
                "summary": "Progression visible à chaque instant, jamais de cul-de-sac.",
                "do": ["Barre de progression sur chaque leçon", "Retour immédiat à chaque réponse"],
                "dont": ["Pages de texte sans respiration", "Plus de trois choix par question"],
            },
        },
    },
    {
        "id": "design-system-creatif",
        "title": {"fr": "Créatif", "en": "Creative"},
        "description": {
            "fr": "Design system audacieux pour un studio créatif : fond papier, rose vif, ombres dures, Syne et DM Sans.",
            "en": "Bold design system for a creative studio: paper background, hot pink, hard shadows, Syne and DM Sans.",
        },
        "tags": ["creative", "studio", "bold", "brutalist"],
        "tone": "bold, playful, confident",
        "spec": {
            "name": "Studio Ondé",
            "description": "Studio de design et motion à Dakar. Audacieux, joueur, sûr de lui.",
            "colors": {
                "bg": "#fff7ec",
                "surface": "#ffffff",
                "fg": "#141414",
                "muted": "#545454",
                "accent": "#d6246e",
                "secondary": "#2f5bea",
                "border": "#141414",
                "success": "#137a3f",
                "warning": "#9a5b00",
                "danger": "#b3261e",
                "info": "#2f5bea",
            },
            "fonts": {"display": "Syne", "body": "DM Sans", "mono": "Space Mono"},
            "type": {"base": 16, "ratio": 1.333},
            "space": 8,
            "radius": {"sm": 0, "md": 4, "lg": 8},
            "shadow": "hard",
            "motion": "snappy",
            "logo": {
                "clearSpace": "La hauteur de la vague tout autour",
                "minSizePx": 40,
                "usage": [
                    "Noir sur papier",
                    "Blanc sur le rose",
                    "Peut être recadré à fond perdu en très grand",
                ],
                "misuse": ["Le centrer timidement en petit", "Ombre portée douce", "Couleurs pastel"],
            },
            "iconography": {
                "library": "lucide",
                "style": "outline",
                "stroke": 2.5,
                "summary": "Traits épais, angles francs, comme dessinés au feutre.",
                "do": ["Icônes grandes et noires", "Flèches pour guider le regard"],
                "dont": ["Icônes fines et grises", "Emojis à la place des icônes"],
            },
            "imagery": {
                "summary": "Projets en très grand, collages, grain de film, couleurs saturées.",
                "do": ["Images à fond perdu", "Recadrages audacieux", "Mélange photo et formes graphiques"],
                "dont": ["Photos de bureau aseptisées", "Cadres arrondis sages"],
            },
            "voice": {
                "summary": "Affirmé et joueur. On montre plus qu'on n'explique.",
                "do": ["Titres courts et percutants", "Jeux de mots assumés", "Première personne du pluriel"],
                "dont": ["Langue de bois d'agence", "Listes de buzzwords", "Ton neutre"],
            },
            "guidelines": {
                "summary": "Contraste maximal, grille visible, une seule couleur vive à la fois.",
                "do": ["Bordures noires de 2 px", "Ombres dures décalées", "Titres immenses"],
                "dont": ["Dégradés", "Coins très arrondis", "Plus d'une couleur vive par écran"],
            },
        },
    },
    {
        "id": "design-system-luxe",
        "title": {"fr": "Luxe", "en": "Luxury"},
        "description": {
            "fr": "Design system raffiné pour une marque de luxe : noir profond, or sobre, Cormorant Garamond et Hanken Grotesk.",
            "en": "Refined design system for a luxury brand: deep black, understated gold, Cormorant Garamond and Hanken Grotesk.",
        },
        "tags": ["luxury", "fashion", "elegant", "dark"],
        "tone": "refined, quiet, timeless",
        "spec": {
            "name": "Maison Orée",
            "description": "Maison de maroquinerie artisanale. Raffinée, discrète, intemporelle.",
            "colors": {
                "bg": "#0c0a09",
                "surface": "#171412",
                "fg": "#f2ece4",
                "muted": "#a8a097",
                "accent": "#c8a96a",
                "secondary": "#8c6b3f",
                "border": "#2a2521",
                "success": "#7fb38a",
                "warning": "#d6b25e",
                "danger": "#d98880",
                "info": "#9bb3c8",
            },
            "fonts": {"display": "Cormorant Garamond", "body": "Hanken Grotesk", "mono": "IBM Plex Mono"},
            "type": {"base": 16, "ratio": 1.414},
            "space": 8,
            "radius": {"sm": 0, "md": 0, "lg": 2},
            "shadow": "none",
            "motion": "calm",
            "logo": {
                "clearSpace": "La hauteur totale du logo de chaque côté",
                "minSizePx": 48,
                "usage": [
                    "Or sur noir",
                    "Noir sur papier ivoire pour l'impression",
                    "Toujours centré, avec beaucoup d'espace",
                ],
                "misuse": [
                    "Or brillant ou effet métallique",
                    "Logo sur une photo de produit",
                    "Taille inférieure à 48 px",
                ],
            },
            "iconography": {
                "library": "lucide",
                "style": "outline",
                "stroke": 1,
                "summary": "Icônes très fines, rares, jamais décoratives.",
                "do": ["Trait de 1 px", "Couleur du texte atténué"],
                "dont": ["Icônes en couleur or", "Icônes dans les titres"],
            },
            "imagery": {
                "summary": "Natures mortes en clair-obscur, matières en très gros plan, beaucoup de noir.",
                "do": ["Une lumière latérale unique", "Le geste de l'artisan", "Grain du cuir visible"],
                "dont": [
                    "Fonds blancs de catalogue",
                    "Mannequins souriants",
                    "Plus de trois produits par image",
                ],
            },
            "voice": {
                "summary": "Peu de mots, choisis. On évoque, on ne vend pas.",
                "do": ["Phrases courtes et posées", "Vocabulaire de l'artisanat", "Vouvoyer"],
                "dont": ["Promotions et pourcentages", "Superlatifs", "Points d'exclamation"],
            },
            "guidelines": {
                "summary": "Le vide est un luxe : beaucoup d'espace, peu d'éléments, aucun bruit.",
                "do": ["Marges généreuses", "Titres en serif, texte en sans", "Or réservé aux détails"],
                "dont": ["Coins arrondis", "Ombres portées", "Plus de deux tailles de texte par bloc"],
            },
        },
    },
]


def _is_dark(hex_value: str) -> bool:
    return contrast_ratio(hex_value, "#ffffff") > contrast_ratio(hex_value, "#000000")


def thumbnail_html(document: dict, colors: dict[str, str], inline) -> str:
    """The gallery card (480 x 270): the guidelines cover in front, the colour and type pages behind.

    Modelled on the Forge brand guidelines: a dark cover with the logo and the icon
    bleeding off the corner, then light editorial pages.
    """
    name = escape(document["name"])
    families = font_families(document)
    display, body = [*families, "sans-serif", "sans-serif"][:2]
    fonts = google_fonts_url(families[:2])
    bg, fg, accent = colors["bg"], colors["fg"], colors["accent"]
    cover = bg if _is_dark(bg) else fg
    on_cover = best_text_on(cover)
    stage = "#101114" if _is_dark(bg) else "#ececee"
    logo, logo_dark, icon = inline(LOGO_PATH), inline(LOGO_DARK_PATH), inline(ICON_PATH)
    swatches = [
        ("accent", accent),
        ("secondary", colors.get("secondary", accent)),
        ("fg", fg),
        ("bg", bg),
    ]
    swatch_html = "".join(
        f'<div class="sw" style="background:{value};color:{best_text_on(value)};'
        f'{"box-shadow:inset 0 0 0 1px #e4e4e7;" if value.lower() in ("#ffffff", "#fff") else ""}">'
        f"<b>{label}</b><span>{value.upper()}</span></div>"
        for label, value in swatches
    )
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="{fonts}">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:480px;height:270px;overflow:hidden;position:relative;background:
radial-gradient(60% 80% at 85% 0%, {accent}2e, transparent 70%),
radial-gradient(50% 70% at 0% 100%, {accent}1f, transparent 70%), {stage};
font-family:"{body}",system-ui,sans-serif}}
.pg{{position:absolute;width:196px;height:139px;background:#fff;border-radius:5px;overflow:hidden;
box-shadow:0 18px 40px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.12);padding:12px 13px}}
.lab{{font-size:4.6px;font-weight:700;letter-spacing:.14em;color:{accent};text-transform:uppercase}}
.ttl{{font-family:"{display}",serif;font-size:13px;color:#111;margin-top:3px;line-height:1.05}}
.hl{{position:absolute;top:10px;right:12px;height:8px}}
.col{{right:12px;top:16px;transform:rotate(4deg)}}
.sws{{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:4px;margin-top:9px;height:72px}}
.sw{{border-radius:3px;padding:5px;display:flex;flex-direction:column;justify-content:flex-end;font-size:4.3px}}
.sw b{{font-weight:700;margin-bottom:1px}} .sw span{{opacity:.8}}
.typ{{right:24px;top:140px;transform:rotate(-3deg)}}
.aa{{font-family:"{display}",serif;font-size:58px;line-height:1;color:{fg if _is_dark(fg) else bg};margin-top:4px}}
.fn{{position:absolute;left:96px;top:44px;font-size:5.4px;color:#555;line-height:1.6}}
.fn b{{display:block;font-size:8px;color:#111;font-family:"{display}",serif}}
.cv{{left:20px;top:52px;width:236px;height:167px;background:{cover};transform:rotate(-3deg);padding:18px 18px;z-index:3}}
.cv .lg{{height:15px;position:relative;z-index:2}}
.cv .big{{position:absolute;right:-22px;bottom:-26px;width:112px;height:112px;opacity:.92}}
.cv .ey{{position:absolute;left:18px;bottom:68px;font-size:5px;letter-spacing:.14em;font-weight:700;color:{accent if contrast_ratio(accent, cover) >= 3 else on_cover}}}
.cv h1{{position:absolute;left:18px;bottom:18px;font-family:"{display}",serif;font-weight:600;font-size:22px;line-height:1;color:{on_cover}}}
.tile{{position:absolute;left:226px;top:192px;width:52px;height:52px;border-radius:12px;background:#fff;z-index:4;
display:grid;place-items:center;box-shadow:0 12px 26px rgba(0,0,0,.3);transform:rotate(-3deg)}}
.tile img{{width:31px;height:31px}}
</style></head><body>
<div class="pg col"><img class="hl" src="{logo}" alt=""><p class="lab">04 · Couleurs</p><p class="ttl">Une palette, un ton</p><div class="sws">{swatch_html}</div></div>
<div class="pg typ"><img class="hl" src="{logo}" alt=""><p class="lab">05 · Typographie</p><p class="aa">Aa</p>
<p class="fn"><b>{escape(display)}</b>Titres<br><b style="margin-top:3px">{escape(body)}</b>Texte courant</p></div>
<div class="pg cv"><img class="lg" src="{logo_dark}" alt="{name}"><img class="big" src="{icon}" alt="">
<p class="ey">VERSION 1.0 · OCTOBRE 2026</p><h1>Charte<br>graphique</h1></div>
<div class="tile"><img src="{icon}" alt=""></div>
</body></html>"""


def render_thumbnail(html: str, out: Path) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 480, "height": 270}, device_scale_factor=2)
        page.set_content(html, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(300)
        page.screenshot(path=str(out), type="png")
        browser.close()


def build_kit(kit: dict) -> Path:
    folder = ROOT / kit["id"]
    folder.mkdir(parents=True, exist_ok=True)
    document, fixes = build_document(
        Spec.model_validate(kit["spec"]),
        logo_src=LOGO_PATH,
        logo_dark_src=LOGO_DARK_PATH,
        logo_icon_src=ICON_PATH,
    )
    if fixes:
        raise SystemExit(f"{kit['id']}: contrast repaired, fix the spec instead: {fixes}")
    colors = colors_of(document)
    spec = kit["spec"]
    (folder / "public" / "brand").mkdir(parents=True, exist_ok=True)
    for source, target in (("logo.svg", LOGO_PATH), ("logo-dark.svg", LOGO_DARK_PATH), ("icon.svg", ICON_PATH)):
        shutil.copyfile(BRANDS / kit["id"] / source, folder / target)
    (folder / "design-system.json").write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (folder / "DESIGN.md").write_text(design_md(document), encoding="utf-8")

    def inline(path: str) -> str:
        data = (folder / path).read_bytes()
        return "data:image/svg+xml;base64," + base64.b64encode(data).decode("ascii")

    render_thumbnail(thumbnail_html(document, colors, inline), folder / "preview.png")
    (folder / "preview.html").write_text(
        brand_site_html(document, asset_url=inline, lang="fr", badge=False, remote_fonts=False),
        encoding="utf-8",
    )
    meta = {
        "kind": "design_system",
        "id": kit["id"],
        "title": kit["title"],
        "description": kit["description"],
        "tags": kit["tags"],
        "preview": "preview.html",
        "bootHint": {
            "fr": f"Adapte {kit['id']} : nom de la marque, public, ton, couleurs à garder.",
            "en": f"Adapt {kit['id']}: brand name, audience, tone, colours to keep.",
        },
        "accent": colors["accent"],
        "bg": colors["bg"],
        "fg": colors["fg"],
        "muted": colors["muted"],
        "tone": kit["tone"],
        "fonts": spec["fonts"],
    }
    (folder / "template.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return folder


def main() -> None:
    for kit in KITS:
        print("built", build_kit(kit).relative_to(ROOT.parent.parent))


if __name__ == "__main__":
    main()
