"""The starter-kit contract, as code (used by the test suite and by kit authors).

Kits are the first files a forked project starts from, so they must already
follow the rules the agent is held to: named `createRoot`, lucide icons,
mobile-first CSS, a foundation stylesheet plus scoped page stylesheets, and
components split into files the context builder can select one by one.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ALLOWED_BARE_IMPORTS = frozenset({"react", "react-dom/client", "lucide-react"})
TOOLCHAIN = {
    "vite": "^5.4.21",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
}
_IMPORT_RE = re.compile(r"""(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']""")
_DEFAULT_DOM_RE = re.compile(r"""import\s+\w+\s+from\s+["']react-dom/client["']""")
_NAMED_ROOT_RE = re.compile(r"""import\s*\{[^}]*\bcreateRoot\b[^}]*\}\s*from\s*["']react-dom/client["']""")
_MAX_WIDTH_MEDIA_RE = re.compile(r"@media[^{]*\bmax-width\b", re.I)
# Emoji and dingbat blocks: used as icons they render differently everywhere.
_ICON_GLYPH_RE = re.compile("[\U0001f300-\U0001faff☀-➿]")
_LUCIDE_IMPORT_RE = re.compile(r"""import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']""")


def _lucide_names() -> frozenset[str]:
    path = Path(__file__).resolve().parents[2] / "runtime" / "lucide_exports.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    names = data if isinstance(data, list) else data.get("exports", [])
    return frozenset(str(n) for n in names)


def kit_violations(kit: Path, kind: str = "web") -> list[str]:
    """Every contract breach of one kit folder, as readable strings."""
    problems: list[str] = []
    src = kit / "src"
    for rel in ("README.md", "DESIGN.md", "src/main.tsx", "src/App.tsx", "src/index.css", "package.json"):
        if not (kit / rel).is_file():
            problems.append(f"missing {rel}")
    if (kit / "manifest.webmanifest").exists():
        problems.append("manifest.webmanifest must live under public/")

    main = (src / "main.tsx").read_text(encoding="utf-8") if (src / "main.tsx").is_file() else ""
    if _DEFAULT_DOM_RE.search(main) or not _NAMED_ROOT_RE.search(main):
        problems.append('src/main.tsx must use import { createRoot } from "react-dom/client"')

    lucide = _lucide_names()
    sources = sorted(p for p in src.rglob("*") if p.suffix in (".tsx", ".ts")) if src.is_dir() else []
    for path in sources:
        rel = path.relative_to(kit).as_posix()
        text = path.read_text(encoding="utf-8")
        for match in _IMPORT_RE.finditer(text):
            spec = match.group(1) or match.group(2)
            if spec.startswith((".", "/")):
                continue
            if spec not in ALLOWED_BARE_IMPORTS:
                problems.append(f"{rel} imports {spec!r} (only react, lucide-react and local files)")
        for match in _LUCIDE_IMPORT_RE.finditer(text):
            for raw in match.group(1).split(","):
                name = raw.strip().split(" as ")[0].strip()
                if name and name not in lucide:
                    problems.append(f"{rel} imports unknown lucide icon {name!r}")
        glyphs = sorted(set(_ICON_GLYPH_RE.findall(text)))
        if glyphs:
            problems.append(f"{rel} uses emoji/dingbat glyphs {glyphs} (use lucide-react icons)")
    components = [p for p in sources if p.parent != src]
    if len(components) < 3:
        problems.append("sections/screens must be split into src/components/ (or src/screens/) files")

    styles = sorted((src / "styles").glob("*.css")) if (src / "styles").is_dir() else []
    if not styles:
        problems.append("page styles must live in src/styles/<page>.css")
    for css in [src / "index.css", *styles]:
        if not css.is_file():
            continue
        rel = css.relative_to(kit).as_posix()
        text = css.read_text(encoding="utf-8")
        if "@import" in text:
            problems.append(f"{rel} must not use @import")
        if _MAX_WIDTH_MEDIA_RE.search(text):
            problems.append(f"{rel} has max-width media queries (write mobile-first min-width)")
    all_tsx = "\n".join(p.read_text(encoding="utf-8") for p in sources)
    for css in styles:
        if f"styles/{css.name}" not in all_tsx:
            problems.append(f"src/styles/{css.name} is never imported")

    try:
        pkg = json.loads((kit / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pkg = {}
    deps = pkg.get("dependencies") or {}
    if "lucide-react" not in deps:
        problems.append("package.json dependencies must include lucide-react")
    dev = pkg.get("devDependencies") or {}
    for name, version in TOOLCHAIN.items():
        if dev.get(name) != version:
            problems.append(f"package.json devDependencies.{name} must be {version}")

    design = (kit / "DESIGN.md").read_text(encoding="utf-8") if (kit / "DESIGN.md").is_file() else ""
    for section in ("## Colors", "## Typography", "## Tone"):
        if section not in design:
            problems.append(f"DESIGN.md misses {section}")
    return problems
