"""Tests for static multi-page route validation."""

from app.services.filesystem import write_file
from app.services.orchestration.page_routes import detect_routes
from app.services.orchestration.page_visit_check import page_route_findings
from app.services.scaffold import scaffold_vite_react


def test_detect_routes_from_pages_dir(project):
    write_file(project, "src/pages/About.tsx", "export default function About() { return null; }")
    files = {
        "src/pages/About.tsx": "export default function About() { return null; }",
        "src/App.tsx": "export default function App() { return null; }",
    }
    routes = detect_routes(files)
    assert "/" in routes
    assert "/About" in routes


def test_missing_route_component_is_critical(project):
    scaffold_vite_react(project, "Demo")
    write_file(
        project,
        "src/App.tsx",
        """
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </BrowserRouter>
  );
}
""".strip(),
    )
    findings = page_route_findings(project)
    codes = {f.code for f in findings}
    assert "route.component_missing" in codes


def test_existing_route_component_passes(project):
    scaffold_vite_react(project, "Demo")
    write_file(project, "src/pages/ContactPage.tsx", "export default function ContactPage() { return null; }")
    write_file(
        project,
        "src/App.tsx",
        """
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ContactPage from "./pages/ContactPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </BrowserRouter>
  );
}
""".strip(),
    )
    critical = [f for f in page_route_findings(project) if f.severity == "critical"]
    assert not any(f.code == "route.component_missing" for f in critical)
