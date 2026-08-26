"""Closed package manifest for generated Vite/React apps (AST allowlist)."""

from __future__ import annotations

from app.plugins_catalog import catalog_package_versions

# Core scaffold packages always allowed (relative + these bare imports).
_CORE_ALLOWED: dict[str, str] = {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "vite": "^5.4.11",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
}

# Additional runtime packages from the Sites spec (fonction.md §11) that we
# allow even if not yet in plugins_catalog.
_SPEC_EXTRA: dict[str, str] = {
    "react-router-dom": "^7.1.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "date-fns": "^4.1.0",
    "recharts": "^2.15.0",
    "sonner": "^1.7.1",
    "cmdk": "^1.0.4",
    "embla-carousel-react": "^8.5.1",
    "@tanstack/react-query": "^5.62.0",
}


def allowed_packages() -> dict[str, str]:
    """package → version pin (catalog wins over extras)."""
    out = dict(_CORE_ALLOWED)
    out.update(_SPEC_EXTRA)
    out.update(catalog_package_versions())
    return out


def is_relative_or_alias(spec: str) -> bool:
    return (
        spec.startswith("./")
        or spec.startswith("../")
        or spec.startswith("/")
        or spec.startswith("@/")
    )


FORBIDDEN_BARE_PREFIXES = (
    "node:",
    "fs",
    "path",
    "child_process",
    "worker_threads",
    "cluster",
    "net",
    "http",
    "https",
    "os",
    "process",
    "vm",
    "module",
)
