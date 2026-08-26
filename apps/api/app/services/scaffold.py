from __future__ import annotations

from pathlib import Path

from app.services.ai_rules import ensure_ai_rules_md
from app.services.filesystem import project_dir, write_bytes, write_file

_FORGE_FAVICON = Path(__file__).resolve().parent.parent / "assets" / "forge-favicon.png"


def forge_favicon_bytes() -> bytes:
    """Default Forge brand icon for generated projects."""
    return _FORGE_FAVICON.read_bytes()


def install_default_favicon(project_id: str) -> None:
    """Write public/favicon.png (Forge icon) unless a favicon already exists."""
    root = project_dir(project_id)
    existing = [
        root / "public" / "favicon.png",
        root / "public" / "favicon.ico",
        root / "public" / "seo" / "favicon.png",
    ]
    if any(p.is_file() for p in existing):
        return
    write_bytes(project_id, "public/favicon.png", forge_favicon_bytes())


def ensure_favicon_link(html: str) -> str:
    """Ensure index.html links /favicon.png (idempotent)."""
    if re_search_favicon(html):
        return html
    link = '    <link rel="icon" type="image/png" href="/favicon.png" />\n'
    if "<head>" in html:
        return html.replace("<head>", "<head>\n" + link.rstrip() + "\n", 1)
    if "</title>" in html:
        return html.replace("</title>", "</title>\n" + link.rstrip(), 1)
    return link + html


def re_search_favicon(html: str) -> bool:
    low = html.lower()
    return 'rel="icon"' in low or "rel='icon'" in low or "favicon." in low


# Lightweight package manifest (no Vite / no install scripts). Runtime comes from CDN import map.
PACKAGE_JSON = """{
  "name": "forge-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "description": "Forge Babel/ESM app — preview & publish without Vite or node_modules",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  }
}
"""

TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
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
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
"""

# Shell used as documentation / ZIP export fallback. Publish regenerates index.html + importmap.
INDEX_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Forge App</title>
    <meta name="description" content="" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="Forge App" />
    <meta property="og:description" content="" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Forge App" />
    <meta name="twitter:description" content="" />
    <meta name="twitter:image" content="" />
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react-dom": "https://esm.sh/react-dom@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
        "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
        "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
        "lucide-react": "https://esm.sh/lucide-react@0.468.0"
      }
    }
    </script>
    <link rel="stylesheet" href="/src/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <!-- Live preview uses the Babel runner; publish rewrites this to ESM .js -->
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
"""

MAIN_TSX = """import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
"""

APP_TSX = """import { Sparkles } from "lucide-react";

export default function App() {
  return (
    <main className="page">
      <h1>
        <span className="accent">F</span>orge
      </h1>
      <p>
        <Sparkles size={18} strokeWidth={2} className="accent-icon" aria-hidden />
        {" "}
        Describe what you want to build in the chat. Forge will update this preview.
      </p>
    </main>
  );
}
"""

INDEX_CSS = """:root {
  color-scheme: dark;
  --bg: #0a0a0a;
  --fg: #f5f5f5;
  --muted: #9a9a9a;
  --accent: #f2620a;
  font-family: "Segoe UI", system-ui, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.page {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.accent { color: var(--accent); }

.accent-icon {
  color: var(--accent);
  vertical-align: -0.2em;
  display: inline;
}

p {
  margin: 0;
  color: var(--muted);
  max-width: 28rem;
}
"""

DESIGN_MD = """# Design charter

This file is the graphic charter for the app. Forge injects it into every AI call.

## Colors
- `--bg`: #0a0a0a
- `--fg`: #f5f5f5
- `--muted`: #9a9a9a
- `--accent`: #f2620a

## Typography
- Sans UI, bold display titles, comfortable body line-height.

## Tone
- Direct, modern, product-focused.

## Logo
- None yet — configure via the Charte graphique panel.

## Do / Don't
- Do use CSS variables from this file.
- Don't invent a second palette.
"""


def _index_html(app_name: str) -> str:
    # The visual-edit bridge used to be inlined here. It now ships with the
    # preview runner shell, so it no longer leaks into the user's exported ZIP.
    return INDEX_HTML.replace("Forge App", app_name)


def scaffold_vite_react(project_id: str, app_name: str) -> None:
    """Scaffold a React/TS app for the Babel/ESM runtime (no Vite / node_modules)."""
    project_dir(project_id)
    slug = app_name.lower().replace(" ", "-")[:40] or "forge-app"
    write_file(project_id, "package.json", PACKAGE_JSON.replace("forge-app", slug))
    write_file(project_id, "tsconfig.json", TSCONFIG)
    write_file(project_id, "index.html", _index_html(app_name))
    write_file(project_id, "src/main.tsx", MAIN_TSX)
    write_file(project_id, "src/App.tsx", APP_TSX)
    write_file(project_id, "src/index.css", INDEX_CSS)
    write_file(project_id, "DESIGN.md", DESIGN_MD)
    write_file(
        project_id,
        "forge.json",
        '{\n  "runtime": "babel_esm",\n  "entry": "src/main.tsx"\n}\n',
    )
    ensure_ai_rules_md(project_id)
    install_default_favicon(project_id)
    write_file(
        project_id,
        "preview.html",
        f"""<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><link rel="icon" type="image/png" href="/favicon.png" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{app_name}</title>
<style>{INDEX_CSS}
html,body{{overflow:hidden}} a,button{{pointer-events:none}}
</style></head>
<body>
<main class="page">
  <h1><span class="accent">F</span>orge</h1>
  <p>Describe what you want to build in the chat. Forge will update this preview.</p>
</main>
</body></html>
""",
    )
    # Baseline checkpoint: the user can always roll back to the pristine scaffold.
    try:
        from app.services import history

        history.snapshot(project_id, "initial scaffold")
    except Exception:  # pragma: no cover - history is best effort
        pass
