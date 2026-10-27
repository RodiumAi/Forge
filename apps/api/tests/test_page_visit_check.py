"""Tests for static multi-page route validation."""

from app.services.filesystem import write_file
from app.services.orchestration.page_routes import detect_routes
from app.services.orchestration.page_visit_check import page_route_findings, state_screen_findings
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


_STATE_APP = """
import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { LibraryScreen } from "./screens/LibraryScreen";

export default function App() {
  const [tab, setTab] = useState<"home" | "search" | "library">("home");
  return (
    <main>
      {tab === "home" && <HomeScreen />}
      {tab === "search" && <SearchScreen />}
      {tab === "library" && <LibraryScreen />}
      <nav><button onClick={() => setTab("search")}>Search</button></nav>
    </main>
  );
}
""".strip()


def test_state_screens_critical_when_written_this_run(project):
    write_file(project, "src/App.tsx", _STATE_APP)
    findings = state_screen_findings(project, {"src/App.tsx"})
    assert [(f.code, f.severity, f.path) for f in findings] == [
        ("route.state_screens", "critical", "src/App.tsx")
    ]
    assert "home, library, search" in findings[0].message


def test_state_screens_only_warn_on_untouched_files(project):
    write_file(project, "src/App.tsx", _STATE_APP)
    findings = state_screen_findings(project, {"src/styles/home.css"})
    assert [f.severity for f in findings] == ["warning"]


def test_state_screens_ignores_routed_apps_and_small_toggles(project):
    write_file(
        project,
        "src/App.tsx",
        _STATE_APP.replace("<main>", '<main><Routes><Route path="/" element={<Home />} /></Routes>'),
    )
    assert state_screen_findings(project, {"src/App.tsx"}) == []
    write_file(
        project,
        "src/App.tsx",
        """
import { useState } from "react";
export default function App() {
  const [view, setView] = useState("grid");
  return view === "grid" ? <Grid /> : <List />;
}
""".strip(),
    )
    assert state_screen_findings(project, {"src/App.tsx"}) == []


def test_state_screens_switch_statement(project):
    write_file(
        project,
        "src/App.tsx",
        """
import { useState } from "react";
function Body({ page }: { page: string }) { return null; }
export default function App() {
  const [page, setPage] = useState("home");
  switch (page) {
    case "about": return <About />;
    case "pricing": return <Pricing />;
    case "contact": return <Contact />;
    default: return <Home />;
  }
}
""".strip(),
    )
    assert [f.code for f in state_screen_findings(project, set())] == ["route.state_screens"]
