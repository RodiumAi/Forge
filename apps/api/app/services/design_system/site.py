"""The brand guidelines page of a design system, as one static HTML document.

Used three ways: the published site (``publish: design_system_site``), the
PDF export (printed by Playwright) and the template previews. Everything is
drawn from ``design-system.json``: the page declares the design system's own
CSS variables, so the swatches, the type specimen and the component showcase
are rendered with the real tokens, not described. No script runs on the page.
"""

from __future__ import annotations

import base64
import mimetypes
from collections.abc import Callable
from html import escape
from typing import Any

from app.services.design_system.color import contrast_ratio, wcag_level
from app.services.design_system.tokens import (
    MISUSE_PREFIX,
    ROLES,
    colors_of,
    contrast_pairs,
    css_variables,
    font_families,
    google_fonts_url,
)
from app.services.filesystem import safe_resolve

_LABELS = {
    "fr": {
        "guidelines": "Charte graphique",
        "colors": "Couleurs",
        "contrast": "Contrastes vérifiés (WCAG 2.2)",
        "typography": "Typographie",
        "spacing": "Espacements, rayons et ombres",
        "spacing_scale": "Espacements",
        "radius": "Rayons",
        "shadow": "Ombres",
        "motion": "Animation",
        "logo": "Logo",
        "clear_space": "Zone de protection",
        "min_size": "Taille minimale",
        "misuse": "À éviter",
        "iconography": "Iconographie",
        "imagery": "Images",
        "voice": "Ton de voix",
        "dos": "À faire et à éviter",
        "do": "À faire",
        "dont": "À éviter",
        "components": "Composants",
        "primary": "Action principale",
        "secondary": "Secondaire",
        "ghost": "Discret",
        "email": "Adresse e-mail",
        "email_hint": "nom@exemple.com",
        "card_title": "Carte",
        "card_body": "Une surface pour regrouper un contenu et ses actions.",
        "badge": "Nouveau",
        "alert_info": "Information utile pour la suite.",
        "alert_success": "Modifications enregistrées.",
        "alert_danger": "Une erreur est survenue.",
        "table_name": "Nom",
        "table_status": "Statut",
        "table_amount": "Montant",
        "active": "Actif",
        "pending": "En attente",
        "made_with": "Fait avec Forge",
        "on": "sur",
    },
    "en": {
        "guidelines": "Brand guidelines",
        "colors": "Colours",
        "contrast": "Checked contrast (WCAG 2.2)",
        "typography": "Typography",
        "spacing": "Spacing, radius and shadows",
        "spacing_scale": "Spacing",
        "radius": "Radius",
        "shadow": "Shadows",
        "motion": "Motion",
        "logo": "Logo",
        "clear_space": "Clear space",
        "min_size": "Minimum size",
        "misuse": "Avoid",
        "iconography": "Iconography",
        "imagery": "Imagery",
        "voice": "Tone of voice",
        "dos": "Do and don't",
        "do": "Do",
        "dont": "Don't",
        "components": "Components",
        "primary": "Primary action",
        "secondary": "Secondary",
        "ghost": "Ghost",
        "email": "Email address",
        "email_hint": "name@example.com",
        "card_title": "Card",
        "card_body": "A surface that groups content and its actions.",
        "badge": "New",
        "alert_info": "Helpful information for what comes next.",
        "alert_success": "Changes saved.",
        "alert_danger": "Something went wrong.",
        "table_name": "Name",
        "table_status": "Status",
        "table_amount": "Amount",
        "active": "Active",
        "pending": "Pending",
        "made_with": "Made with Forge",
        "on": "on",
    },
}

# Six outline icons (24x24, stroke=currentColor), enough to show the icon style.
_ICONS = (
    '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    '<path d="M20 6L9 17l-5-5"/>',
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
)

_TYPE_ROWS = (
    ("display", "--font-display", "--text-5xl", 700),
    ("h1", "--font-display", "--text-4xl", 700),
    ("h2", "--font-display", "--text-3xl", 600),
    ("h3", "--font-display", "--text-2xl", 600),
    ("body", "--font-body", "--text-base", 400),
    ("small", "--font-body", "--text-sm", 400),
    ("caption", "--font-body", "--text-xs", 500),
    ("code", "--font-mono", "--text-sm", 400),
)

_STYLE = """
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body,system-ui,sans-serif);
line-height:var(--leading-normal,1.55);font-size:var(--text-base,16px)}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header.hero{padding:72px 0 48px;border-bottom:1px solid var(--border)}
.hero img{max-height:72px;max-width:320px;display:block;margin-bottom:28px}
.eyebrow{font-size:var(--text-sm,13px);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1,h2,h3{font-family:var(--font-display,inherit);line-height:var(--leading-tight,1.15);margin:0}
h1{font-size:clamp(36px,6vw,var(--text-5xl,61px));margin:8px 0 16px}
h2{font-size:clamp(26px,3.4vw,var(--text-3xl,39px));margin-bottom:24px}
h3{font-size:var(--text-lg,20px);margin-bottom:12px}
.lead{max-width:720px;color:var(--muted);font-size:var(--text-lg,20px)}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px}
nav.toc a{color:var(--fg);text-decoration:none;border:1px solid var(--border);border-radius:var(--radius-full,999px);
padding:6px 14px;font-size:var(--text-sm,13px)}
section{padding:56px 0;border-bottom:1px solid var(--border)}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.swatch{border:1px solid var(--border);border-radius:var(--radius-lg,16px);overflow:hidden;background:var(--surface)}
.chip{height:96px}
.swatch .meta{padding:12px 14px;font-size:var(--text-sm,13px)}
.swatch b{display:block;font-size:var(--text-base,16px)}
.muted{color:var(--muted)}
code,.mono{font-family:var(--font-mono,ui-monospace,monospace);font-size:.92em}
table{width:100%;border-collapse:collapse;font-size:var(--text-sm,13px)}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:600}
.lvl{display:inline-block;border-radius:var(--radius-full,999px);padding:2px 10px;font-weight:600;font-size:12px}
.lvl.ok{background:var(--success);color:var(--bg)}
.lvl.ko{background:var(--danger);color:var(--bg)}
.pair{display:inline-flex;align-items:center;justify-content:center;width:44px;height:30px;border-radius:8px;
font-weight:700;border:1px solid var(--border)}
.spec{display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:baseline;padding:14px 0;
border-bottom:1px dashed var(--border)}
.spec .meta{font-size:var(--text-sm,13px);color:var(--muted)}
.spec p{margin:0;overflow-wrap:anywhere}
.bars{display:grid;gap:10px}
.bar{display:flex;align-items:center;gap:14px;font-size:var(--text-sm,13px)}
.bar span.v{height:14px;background:var(--accent);border-radius:4px}
.radii,.shadows{display:flex;flex-wrap:wrap;gap:18px}
.radii div,.shadows div{width:110px;height:84px;background:var(--surface);border:1px solid var(--border);
display:flex;align-items:flex-end;padding:8px;font-size:12px;color:var(--muted)}
.shadows div{border:none}
.two{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,16px);padding:24px}
.logo-box{display:flex;align-items:center;justify-content:center;min-height:180px;border-radius:var(--radius-lg,16px);
background:var(--surface);border:1px dashed var(--border);padding:32px}
.logo-box.dark{background:#0b0b0f}
.logo-box img{max-width:80%;max-height:110px}
.logo-box .space{outline:2px dashed var(--accent);outline-offset:18px}
ul.list{margin:0;padding-left:20px}
ul.list li{margin:6px 0}
.dd h3.do{color:var(--success)}
.dd h3.dont{color:var(--danger)}
.icons{display:flex;flex-wrap:wrap;gap:14px}
.icons span{width:56px;height:56px;border-radius:var(--radius-md,8px);background:var(--surface);
border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--fg)}
.icons svg{width:var(--icon-size-lg,24px);height:var(--icon-size-lg,24px)}
.showcase{display:grid;gap:24px}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.btn{font:inherit;font-weight:600;border-radius:var(--radius-md,8px);padding:10px 18px;border:1px solid transparent;
cursor:pointer;transition:background var(--motion-fast,150ms) var(--ease-standard,ease)}
.btn.primary{background:var(--accent);color:var(--accent-contrast)}
.btn.secondary{background:var(--surface);color:var(--fg);border-color:var(--border)}
.btn.ghost{background:transparent;color:var(--accent)}
.field{display:grid;gap:6px;max-width:360px;font-size:var(--text-sm,13px)}
.field input{font:inherit;font-size:var(--text-base,16px);padding:10px 12px;border-radius:var(--radius-md,8px);
border:1px solid var(--border);background:var(--surface);color:var(--fg)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,16px);padding:20px;
box-shadow:var(--shadow-md,none);max-width:320px}
.badge{display:inline-block;border-radius:var(--radius-full,999px);padding:3px 10px;font-size:12px;font-weight:600}
.badge.accent{background:var(--accent);color:var(--accent-contrast)}
.badge.soft{background:var(--surface);color:var(--fg);border:1px solid var(--border)}
.alert{border-radius:var(--radius-md,8px);padding:12px 16px;border:1px solid;font-size:var(--text-sm,13px);max-width:520px}
.alert.info{border-color:var(--info);color:var(--fg)}
.alert.success{border-color:var(--success);color:var(--fg)}
.alert.danger{border-color:var(--danger);color:var(--fg)}
.alert b{margin-right:6px}
.alert.info b{color:var(--info)}.alert.success b{color:var(--success)}.alert.danger b{color:var(--danger)}
footer{padding:40px 0 56px;color:var(--muted);font-size:var(--text-sm,13px)}
.badge-forge{position:fixed;right:16px;bottom:16px;background:var(--fg);color:var(--bg);border-radius:999px;
padding:6px 12px;font-size:12px;font-weight:600;text-decoration:none}
@media (max-width:640px){.spec{grid-template-columns:1fr}header.hero{padding-top:48px}}
@media print{.badge-forge{position:static;display:inline-block}section{break-inside:avoid-page}nav.toc{display:none}}
"""


def local_asset_url(project_id: str) -> Callable[[str], str]:
    """Assets inlined as data URIs (PDF and previews: no server behind the page)."""

    def resolve(path: str) -> str:
        try:
            file = safe_resolve(project_id, path)
            data = file.read_bytes()
        except (OSError, ValueError):
            return ""
        if len(data) > 2_000_000:
            return ""
        ctype = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        if file.suffix.lower() == ".svg":
            ctype = "image/svg+xml"
        return f"data:{ctype};base64,{base64.b64encode(data).decode('ascii')}"

    return resolve


def _guidance(block: Any, labels: dict[str, str]) -> str:
    if not isinstance(block, dict):
        return ""
    parts = []
    if block.get("summary"):
        parts.append(f'<p class="lead" style="font-size:inherit">{escape(str(block["summary"]))}</p>')
    dos = "".join(f"<li>{escape(str(x))}</li>" for x in block.get("do") or [])
    donts = "".join(f"<li>{escape(str(x))}</li>" for x in block.get("dont") or [])
    if dos or donts:
        parts.append('<div class="two dd">')
        if dos:
            parts.append(
                f'<div class="panel"><h3 class="do">{labels["do"]}</h3><ul class="list">{dos}</ul></div>'
            )
        if donts:
            parts.append(
                f'<div class="panel"><h3 class="dont">{labels["dont"]}</h3><ul class="list">{donts}</ul></div>'
            )
        parts.append("</div>")
    return "".join(parts)


def brand_site_html(
    document: dict[str, Any],
    *,
    asset_url: Callable[[str], str],
    lang: str = "en",
    badge: bool = True,
    remote_fonts: bool = True,
) -> str:
    """The page. ``remote_fonts=False`` leaves out the Google Fonts stylesheet
    (gallery previews stay single origin and fall back to the font stacks)."""
    labels = _LABELS["fr" if lang == "fr" else "en"]
    name = escape(str(document.get("name") or "Design system"))
    variables = css_variables(document)
    colors = colors_of(document)
    fonts_url = google_fonts_url(font_families(document))
    root = "".join(f"{key}:{value};" for key, value in variables.items())
    toc: list[tuple[str, str]] = []
    body: list[str] = []

    def section(anchor: str, title: str, html: str) -> None:
        if not html:
            return
        toc.append((anchor, title))
        body.append(
            f'<section id="{anchor}"><div class="wrap"><h2>{escape(title)}</h2>{html}</div></section>'
        )

    # Colours and contrast
    swatches = []
    for token_name, value in colors.items():
        on = variables.get("--accent-contrast") if token_name == "accent" else None
        text_on = on or (
            "#ffffff" if contrast_ratio("#ffffff", value) >= contrast_ratio("#0b0b0f", value) else "#0b0b0f"
        )
        swatches.append(
            f'<div class="swatch"><div class="chip" style="background:{value};color:{text_on};'
            f'display:flex;align-items:flex-end;padding:10px;font-weight:700">Aa</div>'
            f'<div class="meta"><b>{escape(token_name)}</b><span class="mono">{value}</span>'
            f'<div class="muted">{escape(ROLES.get(token_name, ""))}</div></div></div>'
        )
    rows = []
    for row in contrast_pairs(colors):
        ok = "ok" if row["pass"] else "ko"
        rows.append(
            f'<tr><td><span class="pair" style="background:{colors[row["bg"]]};color:{colors[row["fg"]]}">Aa</span></td>'
            f"<td><code>--{row['fg']}</code> {labels['on']} <code>--{row['bg']}</code></td>"
            f"<td>{row['ratio']}:1</td><td><span class='lvl {ok}'>{row['level']}</span></td>"
            f"<td class='muted'>{escape(row['use'])}</td></tr>"
        )
    section(
        "colors",
        labels["colors"],
        f'<div class="grid">{"".join(swatches)}</div><h3 style="margin-top:32px">{labels["contrast"]}</h3>'
        f"<table>{''.join(rows)}</table>",
    )

    # Typography
    specs = []
    for label, family, size, weight in _TYPE_ROWS:
        if family not in variables:
            continue
        sample = (
            name
            if label in ("display", "h1")
            else (
                "const tokens = await load();"
                if label == "code"
                else (
                    "Le design system habille chaque projet."
                    if lang == "fr"
                    else "The design system dresses every project."
                )
            )
        )
        specs.append(
            f'<div class="spec"><div class="meta">{label}<br><span class="mono">{escape(variables.get(size, ""))}'
            f'</span></div><p style="font-family:var({family});font-size:min(var({size}),11vw);font-weight:{weight};'
            f'line-height:1.2">{escape(sample)}</p></div>'
        )
    families = "".join(
        f'<div class="panel"><div class="eyebrow">{role}</div><h3 style="font-family:var(--font-{role});'
        f'font-size:28px;margin-top:8px">{escape(family)}</h3><p class="muted mono" style="margin:0">'
        f"Aa Bb Cc 0123456789</p></div>"
        for role, family in zip(("display", "body", "mono"), font_families(document), strict=False)
    )
    section(
        "typography",
        labels["typography"],
        f'<div class="two">{families}</div><div style="margin-top:24px">{"".join(specs)}</div>',
    )

    # Spacing, radius, shadows, motion
    bars = "".join(
        f'<div class="bar"><span class="mono" style="width:90px">{key[2:]}</span>'
        f'<span class="v" style="width:var({key})"></span><span class="muted">{value}</span></div>'
        for key, value in variables.items()
        if key.startswith("--space-")
    )
    radii = "".join(
        f'<div style="border-radius:var({key})">{key[9:]}</div>'
        for key in variables
        if key.startswith("--radius-") and key != "--radius-full"
    )
    shadows = "".join(
        f'<div style="box-shadow:var({key});border-radius:var(--radius-md,8px)">{key[9:]}</div>'
        for key in variables
        if key.startswith("--shadow-")
    )
    motion = ", ".join(
        f"<code>{key[2:]}</code> {escape(value)}"
        for key, value in variables.items()
        if key.startswith(("--motion-", "--ease-"))
    )
    section(
        "spacing",
        labels["spacing"],
        f'<h3>{labels["spacing_scale"]}</h3><div class="bars">{bars}</div>'
        f'<h3 style="margin-top:32px">{labels["radius"]}</h3><div class="radii">{radii}</div>'
        f'<h3 style="margin-top:32px">{labels["shadow"]}</h3><div class="shadows">{shadows}</div>'
        + (f'<h3 style="margin-top:32px">{labels["motion"]}</h3><p>{motion}</p>' if motion else ""),
    )

    # Logo
    logo = document.get("logo") if isinstance(document.get("logo"), dict) else None
    if logo and logo.get("src"):
        src = asset_url(str(logo["src"]))
        dark_src = asset_url(str(logo["darkSrc"])) if logo.get("darkSrc") else ""
        usage = [line for line in logo.get("usage") or [] if not line.startswith(MISUSE_PREFIX)]
        misuse = [
            line[len(MISUSE_PREFIX) :] for line in logo.get("usage") or [] if line.startswith(MISUSE_PREFIX)
        ]
        facts = []
        if logo.get("clearSpace"):
            facts.append(f"<li><b>{labels['clear_space']}</b> : {escape(str(logo['clearSpace']))}</li>")
        if logo.get("minSizePx"):
            facts.append(f"<li><b>{labels['min_size']}</b> : {int(logo['minSizePx'])} px</li>")
        facts += [f"<li>{escape(line)}</li>" for line in usage]
        misuse_html = "".join(f"<li>{escape(line)}</li>" for line in misuse)
        img = f'<img src="{escape(src)}" alt="{name}">' if src else f"<b>{name}</b>"
        # The dark-background version when there is one, else the logo at its minimum size.
        min_px = int(logo.get("minSizePx") or 24)
        if dark_src:
            second = f'<div class="logo-box dark"><img src="{escape(dark_src)}" alt="{name}"></div>'
        elif src:
            second = (
                f'<div class="logo-box"><img src="{escape(src)}" alt="{name}" style="height:{min_px}px">'
                f'<span class="muted" style="margin-left:12px">{min_px} px</span></div>'
            )
        else:
            second = ""
        section(
            "logo",
            labels["logo"],
            f'<div class="two"><div class="logo-box"><span class="space">{img}</span></div>'
            f"{second}</div>"
            f'<div class="two dd" style="margin-top:24px"><div class="panel"><ul class="list">{"".join(facts)}</ul></div>'
            + (
                f'<div class="panel"><h3 class="dont">{labels["misuse"]}</h3><ul class="list">{misuse_html}</ul></div>'
                if misuse_html
                else ""
            )
            + "</div>",
        )

    # Iconography
    icon = (document.get("tokens") or {}).get("icon") or {}
    if isinstance(icon, dict) and icon:
        stroke = variables.get("--icon-stroke", "1.75px").removesuffix("px")
        filled = (icon.get("style") or {}).get("$value") == "filled"
        icons = "".join(
            f'<span><svg viewBox="0 0 24 24" fill="{"currentColor" if filled else "none"}" stroke="currentColor" '
            f'stroke-width="{escape(stroke)}" stroke-linecap="round" stroke-linejoin="round">{path}</svg></span>'
            for path in _ICONS
        )
        guidance = (((icon.get("style") or {}).get("$extensions") or {}).get("forge") or {}).get("guidance")
        library = escape(str((icon.get("library") or {}).get("$value") or ""))
        section(
            "iconography",
            labels["iconography"],
            f'<p class="muted">{library} · {escape(str((icon.get("style") or {}).get("$value") or ""))} · '
            f'{escape(variables.get("--icon-stroke", ""))}</p><div class="icons">{icons}</div>'
            + (f'<div style="margin-top:24px">{_guidance(guidance, labels)}</div>' if guidance else ""),
        )

    section("imagery", labels["imagery"], _guidance(document.get("imagery"), labels))
    section("voice", labels["voice"], _guidance(document.get("voice"), labels))
    section("guidelines", labels["dos"], _guidance(document.get("guidelines"), labels))

    # Components
    showcase = {
        "button": (
            f'<div class="row"><button class="btn primary">{labels["primary"]}</button>'
            f'<button class="btn secondary">{labels["secondary"]}</button>'
            f'<button class="btn ghost">{labels["ghost"]}</button></div>'
        ),
        "input": (
            f'<label class="field">{labels["email"]}<input type="email" placeholder="{labels["email_hint"]}"></label>'
        ),
        "card": (
            f'<div class="card"><h3>{labels["card_title"]}</h3><p class="muted" style="margin:0 0 16px">'
            f'{labels["card_body"]}</p><button class="btn primary">{labels["primary"]}</button></div>'
        ),
        "badge": (
            f'<div class="row"><span class="badge accent">{labels["badge"]}</span>'
            f'<span class="badge soft">{labels["pending"]}</span></div>'
        ),
        "alert": (
            f'<div class="showcase"><div class="alert info"><b>i</b>{labels["alert_info"]}</div>'
            f'<div class="alert success"><b>✓</b>{labels["alert_success"]}</div>'
            f'<div class="alert danger"><b>!</b>{labels["alert_danger"]}</div></div>'
        ),
        "table": (
            f"<table><thead><tr><th>{labels['table_name']}</th><th>{labels['table_status']}</th>"
            f"<th>{labels['table_amount']}</th></tr></thead><tbody>"
            f"<tr><td>Atlas</td><td><span class='badge accent'>{labels['active']}</span></td><td>1 240</td></tr>"
            f"<tr><td>Borealis</td><td><span class='badge soft'>{labels['pending']}</span></td><td>860</td></tr>"
            "</tbody></table>"
        ),
    }
    picked = [c for c in document.get("components") or list(showcase) if c in showcase]
    section(
        "components",
        labels["components"],
        '<div class="showcase">'
        + "".join(
            f'<div><div class="eyebrow" style="margin-bottom:10px">{c}</div>{showcase[c]}</div>'
            for c in picked
        )
        + "</div>",
    )

    logo_src = asset_url(str(logo["src"])) if logo and logo.get("src") else ""
    hero_logo = f'<img src="{escape(logo_src)}" alt="">' if logo_src else ""
    description = escape(str(document.get("description") or ""))
    nav = "".join(f'<a href="#{anchor}">{escape(title)}</a>' for anchor, title in toc)
    fonts_link = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link rel="stylesheet" href="{escape(fonts_url)}">'
        if fonts_url and remote_fonts
        else ""
    )
    forge_badge = (
        f'<a class="badge-forge" href="https://forge.rodiumai.io" rel="noopener">{labels["made_with"]}</a>'
        if badge
        else ""
    )
    level = wcag_level(contrast_ratio(colors.get("fg", "#000000"), colors.get("bg", "#ffffff")))
    return (
        f'<!doctype html><html lang="{"fr" if lang == "fr" else "en"}"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{name} · {labels['guidelines']}</title>"
        f'<meta name="description" content="{description or name}">'
        f"{fonts_link}<style>:root{{{root}}}{_STYLE}</style></head><body>"
        f'<header class="hero"><div class="wrap">{hero_logo}<div class="eyebrow">{labels["guidelines"]}</div>'
        f"<h1>{name}</h1>{f'<p class=lead>{description}</p>' if description else ''}"
        f'<nav class="toc">{nav}</nav></div></header>'
        + "".join(body)
        + f'<footer><div class="wrap">{name} · {labels["guidelines"]} · WCAG {level}</div></footer>'
        + forge_badge
        + "</body></html>"
    )
