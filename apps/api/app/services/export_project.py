"""Build a downloadable ZIP of a Forge project with a local README."""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

from app.services.filesystem import project_dir

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
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    return False


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
            for path in _iter_files(root):
                add_file(path, _arcname_for(path, root, ""))
        else:
            assert layout.front_root and layout.back_root
            front = layout.front_root.resolve()
            back = layout.back_root.resolve()

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

    slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in project_name.lower()).strip("-") or "project"
    filename = f"{slug}-export.zip"
    return buf.getvalue(), filename
