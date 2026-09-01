"""Static multi-page route validation (no headless browser)."""

from __future__ import annotations

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
