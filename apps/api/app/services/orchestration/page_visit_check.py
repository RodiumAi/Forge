"""Static multi-page route validation (no headless browser)."""

from __future__ import annotations

import re

from app.services.filesystem import list_files
from app.services.orchestration.page_routes import (
    component_exists,
    detect_routes,
    route_component_pairs,
)
from app.services.orchestration.verify_build import VerifyFinding


def page_route_findings(project_id: str) -> list[VerifyFinding]:
    files = list_files(project_id)
    if not files:
        return []

    routes = detect_routes(files)
    findings: list[VerifyFinding] = []

    app_content = ""
    for path in ("src/App.tsx", "src/App.jsx", "src/routes.tsx", "src/router.tsx"):
        if path in files:
            app_content = files[path]
            break

    for route, component in route_component_pairs(app_content):
        if component_exists(component, files):
            continue
        findings.append(
            VerifyFinding(
                code="route.component_missing",
                severity="critical",
                path="src/App.tsx" if app_content else "src/",
                message=(
                    f'Route "{route}" renders <{component} /> but no matching module exists '
                    f"(expected src/pages/{component}.tsx or similar). Create the page component "
                    "or fix the Route element."
                ),
            )
        )

    non_home = [r for r in routes if r != "/"]
    if len(non_home) > 1:
        linked = {route for route, _ in route_component_pairs(app_content)}
        for route in non_home:
            if route in linked:
                continue
            if any(route in content for content in files.values() if isinstance(content, str)):
                continue
            findings.append(
                VerifyFinding(
                    code="route.unreachable",
                    severity="warning",
                    path="src/App.tsx",
                    message=(
                        f'Route "{route}" is declared but has no <Route element=...> binding '
                        "and no obvious page module — preview navigation may not reach it."
                    ),
                )
            )

    return findings


# `const [tab, setTab] = useState<Tab>("home")`: a state that names the
# screen or page on show. In-screen segmented controls are named the same way,
# so the check also wants that state to pick between 3+ rendered components.
_SCREEN_STATE_RE = re.compile(
    r"""const\s*\[\s*(\w+)\s*,\s*set\w*?(?:Tab|Screen|Page|View|Route)\s*\]\s*=\s*(?:React\.)?useState\b""",
)
_ROUTER_RE = re.compile(r"<Routes\b|createBrowserRouter|createHashRouter|useRoutes\s*\(")


def _rendered_branches(content: str, var: str) -> set[str]:
    """Literals of `var` that choose what renders: `var === "x" && <`, `? <`, `case "x": return <`."""
    name = re.escape(var)
    literals: set[str] = set()
    for match in re.finditer(
        rf"""\b{name}\s*===?\s*["'](\w[\w-]*)["']\s*(?:&&|\?)\s*\(?\s*<[A-Za-z>]""", content
    ):
        literals.add(match.group(1))
    if re.search(rf"switch\s*\(\s*{name}\s*\)", content):
        for match in re.finditer(r"""case\s*["'](\w[\w-]*)["']\s*:\s*return\s*\(?\s*<[A-Za-z>]""", content):
            literals.add(match.group(1))
    return literals


def state_screen_findings(project_id: str, written: set[str] | None = None) -> list[VerifyFinding]:
    """Screens or pages switched by a `useState` instead of URL routes.

    Critical (so the repair pass converts them) only when this run wrote the
    file holding the switch: an older project is not rewritten on an unrelated
    small edit, it gets a warning and the user can ask for the conversion.
    """
    files = list_files(project_id)
    if not files or "deck.json" in files:
        return []
    sources = {
        path: content
        for path, content in files.items()
        if isinstance(content, str) and path.startswith("src/") and path.endswith((".tsx", ".jsx"))
    }
    if any(_ROUTER_RE.search(content) for content in sources.values()):
        return []

    findings: list[VerifyFinding] = []
    for path, content in sorted(sources.items()):
        for match in _SCREEN_STATE_RE.finditer(content):
            var = match.group(1)
            branches = _rendered_branches(content, var)
            if len(branches) < 3:
                continue
            listed = ", ".join(sorted(branches)[:8])
            findings.append(
                VerifyFinding(
                    code="route.state_screens",
                    severity="critical" if written is not None and path in written else "warning",
                    path=path,
                    message=(
                        f'Screens are switched with the "{var}" state ({listed}) instead of URL '
                        "routes, so the URL never changes and only one page exists. Convert them "
                        "to react-router-dom: <BrowserRouter> in src/main.tsx, <Routes> in "
                        "src/App.tsx, one component per screen (src/screens/<Name>Screen.tsx for "
                        "apps, src/pages/<Name>.tsx for sites) at a kebab path (Home -> /), tabs "
                        "and nav as <NavLink>, onboarding as its own /onboarding route, "
                        "useNavigate instead of the setter. Keep sheets, modals and in-screen "
                        "tabs as state, and keep the design and data unchanged."
                    ),
                )
            )
            break
    return findings
