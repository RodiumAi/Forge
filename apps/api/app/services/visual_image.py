"""Replace image src paths in project source files (visual image tool)."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from app.services.filesystem import list_files, write_file

_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css", ".html", ".svg")
_SKIP_PARTS = {"node_modules", "dist", ".vite", ".git"}


@dataclass
class VisualImageResult:
    path: str
    occurrences: int


def _normalize_src(src: str) -> list[str]:
    raw = (src or "").strip()
    if not raw:
        return []
    variants: list[str] = [raw]
    parsed = urlparse(raw)
    path = unquote(parsed.path or raw)
    if path and path != raw:
        variants.append(path)
    # Strip preview proxy prefix /preview/{uuid}/
    if "/preview/" in path:
        parts = path.split("/")
        try:
            idx = parts.index("preview")
            if idx + 2 < len(parts):
                rest = "/" + "/".join(parts[idx + 2 :])
                variants.append(rest)
                if rest.startswith("/"):
                    variants.append(rest.lstrip("/"))
                    variants.append("public/" + rest.lstrip("/"))
        except ValueError:
            pass
    if path.startswith("/"):
        variants.append(path.lstrip("/"))
        variants.append("public/" + path.lstrip("/"))
        base = path.rsplit("/", 1)[-1]
        if base:
            variants.append(base)
            variants.append(f"/{base}")
            variants.append(f"public/{base}")
    # Dedupe
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def apply_visual_image_replace(
    project_id: str,
    old_src: str,
    new_public_path: str,
) -> VisualImageResult:
    new_path = (new_public_path or "").strip().replace("\\", "/")
    if not new_path:
        raise ValueError("Missing new image path")
    if new_path.startswith("public/"):
        web_path = "/" + new_path[len("public/") :]
    elif new_path.startswith("/"):
        web_path = new_path
        new_path = "public/" + new_path.lstrip("/")
    else:
        web_path = "/" + new_path.lstrip("/")
        if not new_path.startswith("public/"):
            # keep as given for source match; web uses leading slash
            pass

    needles = _normalize_src(old_src)
    if not needles:
        raise ValueError("Missing old image src")

    files = list_files(project_id)
    matches: list[tuple[str, str, str, int]] = []

    for path, content in files.items():
        parts = path.split("/")
        if any(p in _SKIP_PARTS for p in parts):
            continue
        if not path.endswith(_SOURCE_EXTS):
            continue
        for lit in needles:
            count = content.count(lit)
            if count > 0:
                matches.append((path, content, lit, count))
                break

    if not matches:
        raise FileNotFoundError("image_src_not_found")

    unique = [m for m in matches if m[3] == 1]
    if len(unique) == 1:
        path, content, lit, _ = unique[0]
    elif len(unique) > 1:
        src_unique = [m for m in unique if m[0].startswith("src/")]
        if len(src_unique) == 1:
            path, content, lit, _ = src_unique[0]
        else:
            raise LookupError("image_src_ambiguous")
    else:
        matches.sort(key=lambda m: (m[3], 0 if m[0].startswith("src/") else 1, m[0]))
        best = matches[0]
        peers = [m for m in matches if m[3] == best[3]]
        if len(peers) > 1:
            raise LookupError("image_src_ambiguous")
        path, content, lit, _ = best

    # Prefer web path (/file.png) when replacing absolute-looking literals.
    replacement = web_path if lit.startswith("/") or lit.startswith("http") else (
        new_path if lit.startswith("public/") else web_path.lstrip("/")
    )
    updated = content.replace(lit, replacement, 1)
    if updated == content:
        raise FileNotFoundError("image_src_not_found")
    write_file(project_id, path, updated)
    return VisualImageResult(path=path, occurrences=1)
