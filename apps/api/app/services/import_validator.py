"""AST import validator (tree-sitter TypeScript/TSX) — BUILD_FORBIDDEN_IMPORT."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.runtime_manifest import (
    FORBIDDEN_BACKEND_PACKAGES,
    FORBIDDEN_BARE_PREFIXES,
    allowed_packages,
    is_relative_or_alias,
)

logger = logging.getLogger("import_validator")

_PKG_NAME_RE = re.compile(r"^((?:@[^/]+/)?[^/]+)")


@dataclass(frozen=True)
class ImportViolation:
    path: str
    specifier: str
    code: str = "BUILD_FORBIDDEN_IMPORT"
    message: str = ""

    def as_dict(self) -> dict:
        return {
            "code": self.code,
            "path": self.path,
            "specifier": self.specifier,
            "message": self.message or f"Import `{self.specifier}` is not in the runtime manifest.",
        }


def _bare_package(spec: str) -> str | None:
    if not spec or is_relative_or_alias(spec):
        return None
    if spec.startswith("node:"):
        return spec
    m = _PKG_NAME_RE.match(spec)
    return m.group(1) if m else spec


def _extract_imports_regex(source: str) -> list[str]:
    """Fallback when tree-sitter is unavailable."""
    found: list[str] = []
    for m in re.finditer(
        r"""(?:from|import)\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)""",
        source,
    ):
        spec = m.group(1) or m.group(2) or m.group(3) or ""
        if spec:
            found.append(spec)
    return found


def _extract_imports_treesitter(source: str) -> list[str] | None:
    try:
        import tree_sitter_typescript as tstype
        from tree_sitter import Language, Parser
    except Exception as exc:
        logger.warning("tree-sitter unavailable, falling back to regex: %s", exc)
        return None

    try:
        language = Language(tstype.language_tsx())
        parser = Parser(language)
        tree = parser.parse(source.encode("utf-8"))
        query = language.query(
            """
            (import_statement source: (string) @spec)
            (export_statement source: (string) @spec)
            (call_expression
              function: (import)
              arguments: (arguments (string) @spec))
            (call_expression
              function: (identifier) @fn
              arguments: (arguments (string) @spec)
              (#eq? @fn "require"))
            """
        )
        captures = query.captures(tree.root_node)
        nodes: list = []
        if isinstance(captures, dict):
            nodes = list(captures.get("spec") or [])
        else:
            for item in captures:
                if not isinstance(item, tuple) or len(item) != 2:
                    continue
                a, b = item
                if b == "spec" and hasattr(a, "text"):
                    nodes.append(a)
                elif a == "spec" and hasattr(b, "text"):
                    nodes.append(b)

        specs: list[str] = []
        for node in nodes:
            raw = getattr(node, "text", None)
            if raw is None:
                continue
            text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
            if text.startswith(("'", '"')):
                text = text[1:-1]
            if text:
                specs.append(text)
        return specs
    except Exception as exc:
        logger.warning("tree-sitter parse failed, falling back to regex: %s", exc)
        return None


def extract_import_specifiers(source: str) -> list[str]:
    specs = _extract_imports_treesitter(source)
    if specs is None:
        specs = _extract_imports_regex(source)
    # de-dupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for s in specs:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def validate_source(
    path: str, source: str, *, allowlist: dict[str, str] | None = None
) -> list[ImportViolation]:
    allow = allowlist or allowed_packages()
    violations: list[ImportViolation] = []
    for spec in extract_import_specifiers(source):
        if is_relative_or_alias(spec):
            continue
        pkg = _bare_package(spec)
        if not pkg:
            continue
        if any(pkg == p or pkg.startswith(p + "/") for p in FORBIDDEN_BARE_PREFIXES) or pkg.startswith(
            "node:"
        ):
            violations.append(
                ImportViolation(
                    path=path,
                    specifier=spec,
                    message=f"Forbidden platform import `{spec}`.",
                )
            )
            continue
        if pkg in FORBIDDEN_BACKEND_PACKAGES:
            # Named explicitly so the repair pass gets an actionable reason
            # instead of a generic "unknown package".
            violations.append(
                ImportViolation(
                    path=path,
                    specifier=spec,
                    code="BACKEND_SDK_FORBIDDEN",
                    message=(
                        f"`{pkg}` is a backend SDK. Forge builds frontend-only "
                        "prototypes: use mock data or localStorage instead."
                    ),
                )
            )
            continue
        if pkg not in allow:
            violations.append(ImportViolation(path=path, specifier=spec))
    return violations


def validate_project_sources(root: str, paths: list[str] | None = None) -> list[ImportViolation]:
    """Validate TS/TSX/JS under project root (CPU-bound — call via cpu_pool)."""
    base = Path(root)
    files: list[Path] = []
    if paths:
        files = [base / p for p in paths]
    else:
        for pattern in ("**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"):
            files.extend(base.glob(pattern))
    skip = {"node_modules", "dist", ".vite", ".git"}
    allow = allowed_packages()
    violations: list[ImportViolation] = []
    for path in files:
        if any(part in skip for part in path.parts):
            continue
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = path.relative_to(base).as_posix()
        violations.extend(validate_source(rel, text, allowlist=allow))
    return violations


def validate_write_content(path: str, content: str) -> list[ImportViolation]:
    """Validate a single forge-write payload before applying to disk."""
    if not path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")):
        return []
    return validate_source(path, content)
