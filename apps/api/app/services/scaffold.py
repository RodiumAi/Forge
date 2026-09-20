from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

from app.services.ai_rules import ensure_ai_rules_md
from app.services.filesystem import project_dir, write_bytes, write_file

_FORGE_FAVICON = Path(__file__).resolve().parent.parent / "assets" / "forge-favicon.png"
_FORGE_LOGO = Path(__file__).resolve().parent.parent / "assets" / "forge-logo.png"

# Legacy text watermark ("F" orange + "orge") — replaced by the real wordmark.
_TEXT_BRAND_MARKERS = (
    '<span className="accent">F</span>orge',
    '<span class="accent">F</span>orge',
    '<span class="a">F</span>orge',
)


def forge_favicon_bytes() -> bytes:
    """Default Forge brand icon for generated projects."""
    return _FORGE_FAVICON.read_bytes()


def forge_logo_bytes() -> bytes:
    """Forge wordmark (dark UI) used for empty preview / card placeholders."""
    return _FORGE_LOGO.read_bytes()


@lru_cache(maxsize=1)
def forge_logo_data_uri() -> str:
    """Self-contained logo for static HTML (card-preview / preview.html)."""
    raw = forge_logo_bytes()
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def is_text_brand_placeholder(html: str) -> bool:
    """True when HTML still uses the old orange-F wordmark text."""
    return any(marker in html for marker in _TEXT_BRAND_MARKERS)


def brand_placeholder_html(*, subtitle: str | None = None) -> str:
    """Centered Forge logo placeholder (dashboard cards + static preview)."""
    sub = subtitle or "Describe what you want to build in the chat. Forge will update this preview."
    logo = forge_logo_data_uri()
    return f"""<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Forge</title>
<style>
html,body{{margin:0;min-height:100vh;overflow:hidden;background:#0a0a0a;color:#9a9a9a;
font-family:"Segoe UI",system-ui,sans-serif}}
.page{{min-height:100vh;display:grid;place-content:center;gap:0.85rem;padding:2rem;text-align:center}}
.brand-logo{{width:min(220px,58vw);height:auto;display:block;margin:0 auto}}
p{{margin:0;max-width:28rem;font-size:0.95rem;line-height:1.45}}
a,button{{pointer-events:none}}
</style></head>
<body>
<main class="page">
  <img class="brand-logo" src="{logo}" alt="Forge" width="220" height="64" />
  <p>{sub}</p>
</main>
</body></html>
"""


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


def install_default_logo(project_id: str) -> None:
    """Write public/forge-logo.png (wordmark) unless already present."""
    root = project_dir(project_id)
    dest = root / "public" / "forge-logo.png"
    if dest.is_file():
        return
    write_bytes(project_id, "public/forge-logo.png", forge_logo_bytes())


_BRAND_LOGO_CSS = """
.brand-logo {
  width: min(220px, 58vw);
  height: auto;
  display: block;
  margin: 0 auto;
}
""".strip()


def upgrade_text_brand_placeholder(project_id: str) -> None:
    """Replace legacy orange-F text watermark with the Forge wordmark (idempotent).

    Touches only projects still on the default scaffold placeholder — real apps
    that happen to mention Forge are left alone unless they use the exact marker.
    """
    root = project_dir(project_id)
    install_default_logo(project_id)

    app_path = root / "src" / "App.tsx"
    if app_path.is_file():
        try:
            app_src = app_path.read_text(encoding="utf-8")
        except OSError:
            app_src = ""
        if app_src and is_text_brand_placeholder(app_src):
            write_file(project_id, "src/App.tsx", APP_TSX)
            css_path = root / "src" / "index.css"
            if css_path.is_file():
                try:
                    css = css_path.read_text(encoding="utf-8")
                except OSError:
                    css = ""
                if css and ".brand-logo" not in css:
                    write_file(project_id, "src/index.css", css.rstrip() + "\n\n" + _BRAND_LOGO_CSS + "\n")

    preview_path = root / "preview.html"
    if preview_path.is_file():
        try:
            preview_src = preview_path.read_text(encoding="utf-8")
        except OSError:
            preview_src = ""
        if preview_src and is_text_brand_placeholder(preview_src):
            write_file(project_id, "preview.html", brand_placeholder_html())


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
      <img
        className="brand-logo"
        src="/forge-logo.png"
        alt="Forge"
        width={220}
        height={64}
      />
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

.brand-logo {
  width: min(220px, 58vw);
  height: auto;
  display: block;
  margin: 0 auto;
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


def _index_html(app_name: str, *, platform: str = "web") -> str:
    # The visual-edit bridge used to be inlined here. It now ships with the
    # preview runner shell, so it no longer leaks into the user's exported ZIP.
    html = INDEX_HTML.replace("Forge App", app_name)
    if platform == "mobile":
        inject = (
            '    <link rel="manifest" href="/manifest.webmanifest" />\n'
            '    <meta name="theme-color" content="#0a0a0a" />\n'
            '    <meta name="apple-mobile-web-app-capable" content="yes" />\n'
            '    <link rel="apple-touch-icon" href="/favicon.png" />\n'
        )
        html = html.replace(
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n'
            + inject,
        )
    return html


APP_TSX_MOBILE = """import { useEffect, useState } from "react";
import { Home, Search, User } from "lucide-react";

const ONBOARD_KEY = "forge_onboard_done";

const SLIDES = [
  {
    title: "Welcome",
    body: "A mobile-first app shell with onboarding, top bar, and bottom tabs.",
  },
  {
    title: "Stay organized",
    body: "Home is your hub. Explore and Profile are one tap away.",
  },
  {
    title: "Ready when you are",
    body: "Describe screens in chat — Forge keeps the app patterns.",
  },
];

type Tab = "home" | "explore" | "profile";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    try {
      setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function finishOnboarding() {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
    setOnboarded(true);
  }

  if (!ready) {
    return <div className="app-shell" />;
  }

  if (!onboarded) {
    const current = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-body">
          <p className="onboard-kicker">
            {slide + 1} / {SLIDES.length}
          </p>
          <h1>{current.title}</h1>
          <p>{current.body}</p>
        </div>
        <div className="onboard-actions">
          {!last ? (
            <button type="button" className="btn-primary" onClick={() => setSlide((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={finishOnboarding}>
              Get started
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={finishOnboarding}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = {
    home: "Home",
    explore: "Explore",
    profile: "Profile",
  };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <h1>{titles[tab]}</h1>
        <button type="button" className="nav-action" aria-label="Account">
          <User size={18} aria-hidden />
        </button>
      </header>
      <main className="app-main">
        {tab === "home" && (
          <>
            <section className="card">
              <h2>Today</h2>
              <p>Your dashboard summary lives here. Ask Forge to add cards, lists, or feeds.</p>
            </section>
            <section className="card">
              <h2>Quick actions</h2>
              <p>Primary CTAs belong on Home — not on a marketing hero.</p>
            </section>
          </>
        )}
        {tab === "explore" && (
          <section className="card">
            <h2>Explore</h2>
            <p>Search, browse, or discover content for this tab.</p>
          </section>
        )}
        {tab === "profile" && (
          <section className="card">
            <h2>Profile</h2>
            <p>Settings, account, and preferences go here.</p>
          </section>
        )}
      </main>
      <nav className="app-tabbar" aria-label="Primary">
        <button
          type="button"
          className={tab === "home" ? "tab active" : "tab"}
          aria-current={tab === "home" ? "page" : undefined}
          onClick={() => setTab("home")}
        >
          <Home size={20} aria-hidden />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={tab === "explore" ? "tab active" : "tab"}
          aria-current={tab === "explore" ? "page" : undefined}
          onClick={() => setTab("explore")}
        >
          <Search size={20} aria-hidden />
          <span>Explore</span>
        </button>
        <button
          type="button"
          className={tab === "profile" ? "tab active" : "tab"}
          aria-current={tab === "profile" ? "page" : undefined}
          onClick={() => setTab("profile")}
        >
          <User size={20} aria-hidden />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
"""

INDEX_CSS_MOBILE = """:root {
  color-scheme: dark;
  --bg: #0a0a0a;
  --fg: #f5f5f5;
  --muted: #9a9a9a;
  --accent: #f2620a;
  --card: #141414;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  font-family: "Segoe UI", system-ui, sans-serif;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  min-height: 100%;
  height: 100%;
  background: var(--bg);
  color: var(--fg);
}

.app-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-navbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: calc(0.75rem + var(--safe-top)) 1rem 0.75rem;
  background: color-mix(in srgb, var(--bg) 88%, #111);
  border-bottom: 1px solid #222;
}

.app-navbar h1 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.nav-action {
  appearance: none;
  border: 0;
  background: #1a1a1a;
  color: var(--fg);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.app-main {
  flex: 1;
  padding: 1rem 1rem 5.75rem;
  display: grid;
  gap: 0.85rem;
  align-content: start;
}

.card {
  background: var(--card);
  border: 1px solid #222;
  border-radius: 1rem;
  padding: 1rem 1.05rem;
}

.card h2 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.card p, .onboard-body p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.app-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  padding: 0.45rem 0.75rem calc(0.45rem + var(--safe-bottom));
  background: color-mix(in srgb, var(--bg) 92%, #111);
  border-top: 1px solid #222;
}

.tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.7rem;
  min-height: 2.75rem;
  padding: 0.35rem;
}

.tab.active { color: var(--accent); }

.onboard {
  padding: calc(1.5rem + var(--safe-top)) 1.25rem calc(1.25rem + var(--safe-bottom));
  justify-content: space-between;
  gap: 1.5rem;
}

.onboard-kicker {
  margin: 0 0 0.75rem !important;
  color: var(--accent) !important;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.onboard-body h1 {
  margin: 0 0 0.75rem;
  font-size: 1.85rem;
  line-height: 1.15;
}

.onboard-actions {
  display: grid;
  gap: 0.6rem;
}

.btn-primary, .btn-ghost {
  appearance: none;
  border: 0;
  border-radius: 0.9rem;
  min-height: 2.85rem;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.7rem 1rem;
}

.btn-primary {
  background: var(--accent);
  color: #111;
}

.btn-ghost {
  background: transparent;
  color: var(--muted);
}
"""

DESIGN_MD_MOBILE = """# Design charter

This file is the graphic charter for the **mobile app** prototype. Forge injects it into every AI call.

## Platform
- Target: mobile-first web app (phone), optionally tablet.
- UI pattern: onboarding (first launch) → top navbar + Home → bottom tab bar.
- Secondary: stack screens with back, sheets, lists, forms — still inside the app shell.

## Colors
- `--bg`: #0a0a0a
- `--fg`: #f5f5f5
- `--muted`: #9a9a9a
- `--accent`: #f2620a

## Typography
- Sans UI, bold screen titles, comfortable body line-height on narrow viewports.

## Tone
- Direct, product-focused, touch-friendly.

## Logo
- None yet — configure via the Charte graphique panel.

## Do / Don't
- Do keep onboarding + top navbar + bottom tabs as the default IA when the user asks for an app.
- Do use CSS variables from this file and respect safe-area insets.
- Don't invent a second palette or switch to a multi-section landing layout.
"""


def _manifest_webmanifest(app_name: str) -> str:
    # Manifest-only PWA (no service worker). Names are JSON-escaped via dumps.
    import json

    payload = {
        "name": app_name,
        "short_name": (app_name[:12] or "App").strip() or "App",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a0a",
        "theme_color": "#0a0a0a",
        "icons": [
            {"src": "/favicon.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/favicon.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def scaffold_vite_react(project_id: str, app_name: str, platform: str = "web") -> None:
    """Scaffold a React/TS app for the Babel/ESM runtime (no Vite / node_modules)."""
    platform = platform if platform in ("web", "mobile") else "web"
    project_dir(project_id)
    slug = app_name.lower().replace(" ", "-")[:40] or "forge-app"
    write_file(project_id, "package.json", PACKAGE_JSON.replace("forge-app", slug))
    write_file(project_id, "tsconfig.json", TSCONFIG)
    write_file(project_id, "index.html", _index_html(app_name, platform=platform))
    write_file(project_id, "src/main.tsx", MAIN_TSX)
    if platform == "mobile":
        write_file(project_id, "src/App.tsx", APP_TSX_MOBILE)
        write_file(project_id, "src/index.css", INDEX_CSS_MOBILE)
        write_file(project_id, "DESIGN.md", DESIGN_MD_MOBILE)
        write_file(project_id, "manifest.webmanifest", _manifest_webmanifest(app_name))
    else:
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
    install_default_logo(project_id)
    write_file(
        project_id,
        "preview.html",
        brand_placeholder_html(),
    )
    # Baseline checkpoint: the user can always roll back to the pristine scaffold.
    try:
        from app.services import history

        history.snapshot(project_id, "initial scaffold")
    except Exception:  # pragma: no cover - history is best effort
        pass
