"""Build a downloadable ZIP of a Forge project with a local README.

Projects run in the Babel/ESM runner in Forge: their package.json has no
scripts and no Vite, and index.html carries an esm.sh import map and a
`/src/main.js` entry rewritten at publish time. Exported as-is, `npm run dev`
and `npm run build` fail exactly as the README promises they work. The export
therefore NORMALISES the frontend into a standard, runnable Vite project:
complete package.json, Vite-compatible index.html, and the config files.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

from app.runtime_manifest import browser_packages, package_version
from app.services.filesystem import project_dir
from app.services.import_validator import bare_package, extract_import_specifiers

SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    "dist",
    ".vite",
    "__pycache__",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
    ".forge",
}
SKIP_FILE_NAMES = {
    ".ds_store",
    "thumbs.db",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    # Forge-internal machinery; meaningless outside the builder.
    "forge.json",
    "ai_rules.md",
    "preview.html",
}
SKIP_SUFFIXES = {".pyc", ".pyo", ".log"}
ENV_PREFIX = ".env."

BACKEND_CANDIDATES = ("backend", "api", "server")
FRONTEND_CANDIDATES = ("frontend", "web", "client")
BACKEND_MARKERS = (
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "go.mod",
    "Cargo.toml",
    "main.py",
    "app.py",
    "manage.py",
    "package.json",
)
VITE_MARKERS = ("vite.config.ts", "vite.config.js", "vite.config.mjs", "index.html")


@dataclass
class ExportLayout:
    mode: str  # "spa" | "dual"
    front_root: Path | None
    back_root: Path | None
    backend_kind: str  # "python" | "node" | "go" | "rust" | "unknown"


def _is_skipped_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.startswith(".")


def _is_skipped_file(path: Path) -> bool:
    name = path.name
    lower = name.lower()
    if lower == "readme.md":
        # Always regenerate README.md at zip root
        return True
    if lower in SKIP_FILE_NAMES:
        return True
    if lower.startswith(ENV_PREFIX) and lower != ".env.example":
        return True
    return path.suffix.lower() in SKIP_SUFFIXES


def _has_any(root: Path, names: tuple[str, ...]) -> bool:
    return any((root / n).exists() for n in names)


def _looks_like_backend(root: Path) -> bool:
    if not root.is_dir():
        return False
    return _has_any(root, BACKEND_MARKERS)


def _looks_like_vite(root: Path) -> bool:
    if not root.is_dir():
        return False
    has_pkg = (root / "package.json").is_file()
    has_vite = _has_any(root, VITE_MARKERS) or (root / "src").is_dir()
    return has_pkg and has_vite


def _detect_backend_kind(root: Path) -> str:
    if (root / "requirements.txt").is_file() or (root / "pyproject.toml").is_file():
        return "python"
    if (root / "go.mod").is_file():
        return "go"
    if (root / "Cargo.toml").is_file():
        return "rust"
    if (root / "package.json").is_file():
        return "node"
    if (root / "main.py").is_file() or (root / "app.py").is_file():
        return "python"
    return "unknown"


def detect_layout(root: Path) -> ExportLayout:
    fe = next((root / n for n in FRONTEND_CANDIDATES if (root / n).is_dir()), None)
    be = next(
        (root / n for n in BACKEND_CANDIDATES if (root / n).is_dir() and _looks_like_backend(root / n)),
        None,
    )

    if fe and be and (_looks_like_vite(fe) or (fe / "package.json").is_file()):
        return ExportLayout(
            mode="dual",
            front_root=fe,
            back_root=be,
            backend_kind=_detect_backend_kind(be),
        )

    if be and (_looks_like_vite(root) or (root / "package.json").is_file()):
        return ExportLayout(
            mode="dual",
            front_root=root,
            back_root=be,
            backend_kind=_detect_backend_kind(be),
        )

    return ExportLayout(
        mode="spa",
        front_root=root,
        back_root=None,
        backend_kind="unknown",
    )


def _iter_files(base: Path) -> list[Path]:
    out: list[Path] = []
    for path in base.rglob("*"):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(base).parts
        if any(_is_skipped_dir(part) for part in rel_parts[:-1]):
            continue
        if _is_skipped_file(path):
            continue
        out.append(path)
    return out


def _arcname_for(path: Path, source_root: Path, prefix: str) -> str:
    rel = path.relative_to(source_root).as_posix()
    if prefix:
        return f"{prefix.rstrip('/')}/{rel}"
    return rel


# --- frontend normalisation ---------------------------------------------------

_VITE_CONFIG = """import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react()] });
"""

_TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
"""

_IMPORTMAP_RE = re.compile(r"\s*<script type=\"importmap\">.*?</script>", re.DOTALL)

_DEV_DEPENDENCIES = ("vite", "@vitejs/plugin-react", "typescript", "@types/react", "@types/react-dom")
_SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs"}


def _discover_source_packages(front: Path) -> set[str]:
    """Bare npm packages imported under front/src (or the whole frontend tree)."""
    src = front / "src"
    root = src if src.is_dir() else front
    allow = browser_packages()
    found: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in _SOURCE_SUFFIXES:
            continue
        if any(part in SKIP_DIR_NAMES or part.startswith(".") for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for spec in extract_import_specifiers(text):
            pkg = bare_package(spec)
            if pkg and pkg in allow:
                found.add(pkg)
    return found


def _export_package_json(front: Path, project_name: str) -> str:
    """Complete package.json: sync deps from imports, pin Vite toolchain + scripts.

    Inside Forge the app runs without npm at all, so the stored package.json often
    lacks scripts/devDependencies — and agents may drop runtime deps that the
    preview still resolves via the CDN import map. Export must therefore:
    1. keep declared dependencies
    2. re-add every browser package actually imported in source
    3. overwrite the Vite toolchain + scripts to known-good manifest pins
    """
    raw: dict = {}
    pkg_file = front / "package.json"
    if pkg_file.is_file():
        try:
            raw = json.loads(pkg_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}

    deps = dict(raw.get("dependencies") or {})
    # Drop toolchain packages that sometimes land in dependencies by mistake.
    for name in _DEV_DEPENDENCIES:
        deps.pop(name, None)

    deps.setdefault("react", package_version("react") or "^18.3.1")
    deps.setdefault("react-dom", package_version("react-dom") or "^18.3.1")
    for pkg in sorted(_discover_source_packages(front)):
        deps.setdefault(pkg, package_version(pkg) or "latest")

    # Always pin the local Vite toolchain from the shared manifest (don't keep a
    # stale Vite 8 / broken `tsc -b` script an agent may have written).
    dev = {
        name: package_version(name) or "latest"
        for name in _DEV_DEPENDENCIES
    }

    scripts = {
        "dev": "vite",
        # No tsc gate on build: generated code must always produce a site, and a
        # separate `typecheck` script stays available for the curious.
        "build": "vite build",
        "preview": "vite preview",
        "typecheck": "tsc --noEmit",
    }

    slug = re.sub(r"[^a-z0-9-]+", "-", project_name.lower()).strip("-") or "forge-app"
    out = {
        "name": raw.get("name") if raw.get("name") not in (None, "", "forge-app", "new-project") else slug,
        "private": True,
        "version": raw.get("version") or "0.0.1",
        "type": "module",
        "scripts": scripts,
        "dependencies": deps,
        "devDependencies": dev,
    }
    return json.dumps(out, indent=2) + "\n"


def _export_index_html(front: Path, project_name: str) -> str:
    """Vite-compatible index.html.

    The stored one carries an esm.sh import map (would fight Vite's bundling
    with a second React copy) and points at `/src/main.js`, an entry that only
    exists after the publish rewrite.
    """
    html = ""
    src = front / "index.html"
    if src.is_file():
        try:
            html = src.read_text(encoding="utf-8")
        except OSError:
            html = ""

    if html:
        html = _IMPORTMAP_RE.sub("", html)
        html = html.replace('src="/src/main.js"', 'src="/src/main.tsx"')
        # The runner injects CSS itself; Vite resolves it from main.tsx.
        html = re.sub(r"\s*<link rel=\"stylesheet\" href=\"/src/index\.css\" />", "", html)
        if "/src/main.tsx" not in html:
            html = html.replace("</body>", '  <script type="module" src="/src/main.tsx"></script>\n  </body>')
        return html

    title = project_name.strip() or "Forge App"
    return (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "  <head>\n"
        '    <meta charset="UTF-8" />\n'
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
        f"    <title>{title}</title>\n"
        "  </head>\n"
        "  <body>\n"
        '    <div id="root"></div>\n'
        '    <script type="module" src="/src/main.tsx"></script>\n'
        "  </body>\n"
        "</html>\n"
    )


def frontend_overrides(front: Path, project_name: str) -> dict[str, str]:
    """arcname (relative to the frontend root) -> normalised content."""
    overrides: dict[str, str] = {
        "package.json": _export_package_json(front, project_name),
        "index.html": _export_index_html(front, project_name),
        # Always ship a known-good Vite + TS config so exports don't inherit
        # half-broken agent rewrites (e.g. Vite 8 + `tsc -b` without refs).
        "vite.config.ts": _VITE_CONFIG,
        "tsconfig.json": _TSCONFIG,
    }
    return overrides


def build_readme(*, project_name: str, layout: ExportLayout, locale: str) -> str:
    fr = locale.lower().startswith("fr")
    name = project_name.strip() or "Forge project"

    if layout.mode == "dual":
        if fr:
            lines = [
                f"# {name}",
                "",
                "Export Forge — projet **frontend + backend**.",
                "",
                "## Structure",
                "",
                "```",
                "frontend/   # application web (Vite / React)",
                "backend/    # API / serveur",
                "README.md   # ce fichier",
                "```",
                "",
                "## Prérequis",
                "",
                "- Node.js 22+ et npm",
            ]
        else:
            lines = [
                f"# {name}",
                "",
                "Forge export — **frontend + backend** project.",
                "",
                "## Structure",
                "",
                "```",
                "frontend/   # web app (Vite / React)",
                "backend/    # API / server",
                "README.md   # this file",
                "```",
                "",
                "## Prerequisites",
                "",
                "- Node.js 22+ and npm",
            ]
        if layout.backend_kind == "python":
            lines.append("- Python 3.11+ et pip" if fr else "- Python 3.11+ and pip")
        elif layout.backend_kind == "go":
            lines.append("- Go 1.21+")
        elif layout.backend_kind == "rust":
            lines.append("- Rust (cargo)")

        if fr:
            lines += [
                "",
                "## Frontend",
                "",
                "```bash",
                "cd frontend",
                "npm install",
                "npm run dev",
                "```",
                "",
                "Ouvre l’URL affichée par Vite (souvent `http://localhost:5173`).",
                "",
                "## Backend",
                "",
            ]
        else:
            lines += [
                "",
                "## Frontend",
                "",
                "```bash",
                "cd frontend",
                "npm install",
                "npm run dev",
                "```",
                "",
                "Open the URL printed by Vite (often `http://localhost:5173`).",
                "",
                "## Backend",
                "",
            ]

        if layout.backend_kind == "python":
            if fr:
                lines += [
                    "```bash",
                    "cd backend",
                    "python -m venv .venv",
                    "# Windows: .venv\\Scripts\\activate",
                    "source .venv/bin/activate",
                    "pip install -r requirements.txt",
                    "# Exemple FastAPI :",
                    "uvicorn main:app --reload",
                    "# ou : uvicorn app.main:app --reload",
                    "```",
                ]
            else:
                lines += [
                    "```bash",
                    "cd backend",
                    "python -m venv .venv",
                    "# Windows: .venv\\Scripts\\activate",
                    "source .venv/bin/activate",
                    "pip install -r requirements.txt",
                    "# FastAPI example:",
                    "uvicorn main:app --reload",
                    "# or: uvicorn app.main:app --reload",
                    "```",
                ]
        elif layout.backend_kind == "node":
            lines += [
                "```bash",
                "cd backend",
                "npm install",
                "npm run dev",
                "# or: npm start",
                "```",
            ]
        elif layout.backend_kind == "go":
            lines += [
                "```bash",
                "cd backend",
                "go mod tidy",
                "go run .",
                "```",
            ]
        else:
            if fr:
                lines += [
                    "Consulte les fichiers du dossier `backend/` (README, package.json, requirements.txt…)",
                    "pour les commandes exactes de démarrage.",
                ]
            else:
                lines += [
                    "Check the files under `backend/` (README, package.json, requirements.txt…)",
                    "for the exact start commands.",
                ]
    else:
        if fr:
            lines = [
                f"# {name}",
                "",
                "Export Forge — application **frontend** (Vite / React).",
                "",
                "## Prérequis",
                "",
                "- Node.js 22+ et npm",
                "",
                "## Démarrer en local",
                "",
                "```bash",
                "npm install",
                "npm run dev",
                "```",
                "",
                "Ouvre l’URL affichée par Vite (souvent `http://localhost:5173`).",
                "",
                "Pour un build de production :",
                "",
                "```bash",
                "npm run build",
                "npm run preview",
                "```",
            ]
        else:
            lines = [
                f"# {name}",
                "",
                "Forge export — **frontend** app (Vite / React).",
                "",
                "## Prerequisites",
                "",
                "- Node.js 22+ and npm",
                "",
                "## Run locally",
                "",
                "```bash",
                "npm install",
                "npm run dev",
                "```",
                "",
                "Open the URL printed by Vite (often `http://localhost:5173`).",
                "",
                "Production build:",
                "",
                "```bash",
                "npm run build",
                "npm run preview",
                "```",
            ]

    if fr:
        lines += [
            "",
            "## Variables d’environnement",
            "",
            "Les fichiers `.env` ne sont **pas** inclus dans l’export (secrets).",
            "Crée un `.env` local à partir de `.env.example` s’il est présent,",
            "ou copie les clés `VITE_*` dont ton app a besoin.",
            "",
            "---",
            "",
            "Généré par [Forge](https://forge.rodium.ai).",
            "",
        ]
    else:
        lines += [
            "",
            "## Environment variables",
            "",
            "`.env` files are **not** included in the export (secrets).",
            "Create a local `.env` from `.env.example` if present,",
            "or copy the `VITE_*` keys your app needs.",
            "",
            "---",
            "",
            "Generated by [Forge](https://forge.rodium.ai).",
            "",
        ]

    return "\n".join(lines)


def build_export_zip(*, project_id: str, project_name: str, locale: str = "fr") -> tuple[bytes, str]:
    """Return (zip_bytes, suggested_filename)."""
    root = project_dir(project_id).resolve()
    layout = detect_layout(root)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        written: set[str] = set()

        def add_file(src: Path, arc: str) -> None:
            if arc in written or not arc:
                return
            written.add(arc)
            zf.write(src, arcname=arc)

        if layout.mode == "spa":
            assert layout.front_root
            overrides = frontend_overrides(layout.front_root, project_name)
            for arc, content in overrides.items():
                written.add(arc)
                zf.writestr(arc, content)
            for path in _iter_files(root):
                add_file(path, _arcname_for(path, root, ""))
        else:
            assert layout.front_root and layout.back_root
            front = layout.front_root.resolve()
            back = layout.back_root.resolve()

            overrides = frontend_overrides(front, project_name)
            for arc, content in overrides.items():
                written.add(f"frontend/{arc}")
                zf.writestr(f"frontend/{arc}", content)

            for path in _iter_files(front):
                try:
                    path.relative_to(back)
                    continue
                except ValueError:
                    pass
                if front == root:
                    rel = path.relative_to(root)
                    if rel.parts and rel.parts[0] in BACKEND_CANDIDATES:
                        continue
                add_file(path, _arcname_for(path, front, "frontend"))

            for path in _iter_files(back):
                add_file(path, _arcname_for(path, back, "backend"))

        readme = build_readme(project_name=project_name, layout=layout, locale=locale)
        zf.writestr("README.md", readme)

    slug = (
        "".join(c if c.isalnum() or c in "-_" else "-" for c in project_name.lower()).strip("-") or "project"
    )
    filename = f"{slug}-export.zip"
    return buf.getvalue(), filename
