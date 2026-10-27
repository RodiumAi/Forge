"""Route discovery for generated Forge apps (mirrors web builder/types.ts)."""

from __future__ import annotations

import re

ROUTE_PATH_RE = re.compile(
    r"""<Route[^>]*\spath\s*=\s*["']([^"']+)["']|path\s*:\s*["']([^"']+)["']""",
    re.I,
)
NAV_LINK_RE = re.compile(r"""(?:to|href)\s*=\s*["'](/(?!/)[^"'#?]*)["']""", re.I)
STATE_PAGE_RE = re.compile(
    r"""setCurrentPage\s*\(\s*['"](\w+)['"]|currentPage\s*===\s*['"](\w+)['"]|navigateTo(\w+)""",
    re.I,
)
ROUTE_ELEMENT_RE = re.compile(
    r"""<Route[^>]*\spath\s*=\s*["']([^"']+)["'][^>]*\selement\s*=\s*\{?\s*<([A-Z][A-Za-z0-9_]*)""",
    re.I,
)
SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js")


def normalize_route(raw: str) -> str | None:
    path = (raw or "").strip()
    if not path or path == "*" or "*" in path or ":" in path:
        return None
    if not path.startswith("/"):
        path = f"/{path}"
    path = path.rstrip("/") or "/"
    if re.search(r"\.(png|jpe?g|webp|gif|svg|css|js|tsx|jsx|html|pdf)$", path, re.I):
        return None
    return path


def parse_routes_from_source(content: str) -> list[str]:
    routes: set[str] = set()
    for match in ROUTE_PATH_RE.finditer(content):
        normalized = normalize_route(match.group(1) or match.group(2) or "")
        if normalized:
            routes.add(normalized)
    for match in NAV_LINK_RE.finditer(content):
        normalized = normalize_route(match.group(1) or "")
        if normalized:
            routes.add(normalized)
    for match in STATE_PAGE_RE.finditer(content):
        page = (match.group(1) or match.group(2) or match.group(3) or "").lower()
        if not page or page == "home":
            routes.add("/")
        else:
            routes.add(f"/{page}")
    return sorted(routes)


def route_component_pairs(content: str) -> list[tuple[str, str]]:
    """Return (route_path, ComponentName) from <Route path= element={<Foo />}."""
    pairs: list[tuple[str, str]] = []
    for match in ROUTE_ELEMENT_RE.finditer(content):
        route = normalize_route(match.group(1) or "")
        component = match.group(2) or ""
        if route and component:
            pairs.append((route, component))
    return pairs


def detect_routes(files: dict[str, str]) -> list[str]:
    """Heuristic routes for multi-page preview validation."""
    routes: set[str] = {"/"}
    for path, _content in files.items():
        norm = path.replace("\\", "/")
        if re.match(r"^src/pages/", norm, re.I) and re.search(r"\.(tsx|jsx|ts|js)$", norm, re.I):
            route = re.sub(r"^src/pages", "", norm, flags=re.I)
            route = re.sub(r"\.(tsx|jsx|ts|js)$", "", route, flags=re.I)
            route = re.sub(r"/index$", "", route, flags=re.I)
            if not route or route == "/":
                routes.add("/")
            else:
                routes.add(route if route.startswith("/") else f"/{route}")
        if re.match(r"^public/.+\.html$", norm, re.I):
            name = re.sub(r"^public/", "", norm, flags=re.I)
            if name.lower() != "index.html":
                routes.add(f"/{name}")
    for content in files.values():
        for route in parse_routes_from_source(content):
            routes.add(route)
    return sorted(routes, key=lambda r: (r != "/", r))


def component_file_candidates(name: str) -> list[str]:
    """Likely paths for a routed page component."""
    bases = [
        f"src/pages/{name}",
        f"src/pages/{name}/index",
        f"src/components/{name}",
        f"src/{name}",
    ]
    out: list[str] = []
    for base in bases:
        for ext in SOURCE_EXTS:
            out.append(f"{base}{ext}")
    return out


def component_exists(name: str, files: dict[str, str]) -> bool:
    return any(candidate in files for candidate in component_file_candidates(name))


def _route_key(route: str) -> str:
    return (normalize_route(route) or "").lower()


def page_file_for_route(route: str, files: dict[str, str]) -> str | None:
    """Source file that renders `route` in the preview, or None.

    Order: an explicit `<Route path="/x" element={<X />}>` pairing, then a
    `src/pages/<x>` file (file-based or state-based navigation), then
    `src/App.tsx` for the home route.
    """
    key = _route_key(route)
    if not key:
        return None
    for content in files.values():
        for path, component in route_component_pairs(content):
            if path.lower() != key:
                continue
            for candidate in component_file_candidates(component):
                if candidate in files:
                    return candidate
    segment = key.strip("/")
    wanted = (
        {segment.replace("-", ""), f"{segment.replace('-', '')}page"}
        if segment
        else {"home", "homepage", "index"}
    )
    for path in sorted(files):
        norm = path.replace("\\", "/")
        if not norm.lower().startswith("src/pages/") or not norm.endswith(SOURCE_EXTS):
            continue
        stem = re.sub(r"\.(tsx|jsx|ts|js)$", "", norm[len("src/pages/") :], flags=re.I)
        stem = re.sub(r"/index$", "", stem, flags=re.I).lower().replace("-", "").replace("_", "")
        if stem in wanted:
            return path
    if key == "/":
        for candidate in ("src/App.tsx", "src/App.jsx"):
            if candidate in files:
                return candidate
    return None
