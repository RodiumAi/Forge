from __future__ import annotations

from app.services.filesystem import project_dir, write_file

PACKAGE_JSON = """{
  "name": "forge-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0 --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
"""

VITE_CONFIG = """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
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
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
"""

INDEX_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Forge App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

MAIN_TSX = """import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
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


def scaffold_vite_react(project_id: str, app_name: str) -> None:
    project_dir(project_id)
    write_file(project_id, "package.json", PACKAGE_JSON.replace("forge-app", app_name.lower().replace(" ", "-")[:40] or "forge-app"))
    write_file(project_id, "vite.config.ts", VITE_CONFIG)
    write_file(project_id, "tsconfig.json", TSCONFIG)
    write_file(project_id, "tsconfig.node.json", '{\n  "compilerOptions": { "composite": true, "skipLibCheck": true, "module": "ESNext", "moduleResolution": "bundler", "allowSyntheticDefaultImports": true },\n  "include": ["vite.config.ts"]\n}\n')
    write_file(project_id, "index.html", INDEX_HTML.replace("Forge App", app_name))
    write_file(project_id, "src/main.tsx", MAIN_TSX)
    write_file(project_id, "src/App.tsx", APP_TSX)
    write_file(project_id, "src/index.css", INDEX_CSS)
    write_file(project_id, "src/vite-env.d.ts", '/// <reference types="vite/client" />\n')
    write_file(project_id, "DESIGN.md", DESIGN_MD)
    write_file(project_id, "public/.gitkeep", "")
    write_file(
        project_id,
        "preview.html",
        f"""<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
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

