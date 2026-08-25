#!/usr/bin/env python3
"""Generate the 10 Forge starter templates under data/templates/."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "templates"

PACKAGE_JSON = """{
  "name": "%s",
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
    "react-dom": "^18.3.1"
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

TSCONFIG_NODE = """{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
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

VITE_ENV = '/// <reference types="vite/client" />\n'

TEMPLATES: list[dict] = [
    {
        "id": "landing-saas",
        "title": {"en": "SaaS landing", "fr": "Landing SaaS"},
        "description": {
            "en": "Hero, features, pricing and CTA for a product launch.",
            "fr": "Hero, fonctionnalités, pricing et CTA pour un lancement produit.",
        },
        "tags": ["landing", "saas", "marketing"],
        "bootHint": {
            "en": "Start from this SaaS landing. Adapt copy, sections and brand colors.",
            "fr": "Pars de cette landing SaaS. Adapte textes, sections et couleurs de marque.",
        },
        "accent": "#F2620A",
        "bg": "#0a0a0a",
        "fg": "#f5f5f5",
        "muted": "#9a9a9a",
        "tone": "Direct, modern, product-focused.",
        "app": """export default function App() {
  return (
    <div className="page">
      <header className="nav">
        <strong className="logo">Nova<span>Ops</span></strong>
        <nav>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a className="btn" href="#cta">Start free</a>
        </nav>
      </header>
      <section className="hero">
        <p className="eyebrow">Ship faster</p>
        <h1>Automate ops without the spreadsheet chaos</h1>
        <p className="lede">One workspace for alerts, runbooks and team handoffs.</p>
        <div className="actions">
          <a className="btn" href="#cta">Get started</a>
          <a className="ghost" href="#features">See how it works</a>
        </div>
      </section>
      <section id="features" className="grid">
        {["Live alerts", "Shared runbooks", "Audit trail"].map((title) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>Replace scattered chats with a single source of truth for incidents.</p>
          </article>
        ))}
      </section>
      <section id="pricing" className="pricing">
        <h2>Simple pricing</h2>
        <div className="plans">
          <article>
            <h3>Starter</h3>
            <p className="price">$0</p>
            <p>For solo builders</p>
          </article>
          <article className="featured">
            <h3>Team</h3>
            <p className="price">$29</p>
            <p>Shared workflows</p>
          </article>
        </div>
      </section>
      <section id="cta" className="cta">
        <h2>Ready to launch?</h2>
        <a className="btn" href="#">Create your workspace</a>
      </section>
    </div>
  );
}
""",
        "css_extra": """
.nav { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 2rem; }
.logo span { color: var(--accent); }
.nav a { color: var(--muted); margin-left:1.25rem; text-decoration:none; }
.hero { padding:4rem 2rem 3rem; max-width:52rem; }
.eyebrow { color: var(--accent); text-transform:uppercase; letter-spacing:.08em; font-size:.75rem; }
.hero h1 { font-size:clamp(2.4rem,6vw,4rem); line-height:1.05; letter-spacing:-.03em; margin:.5rem 0 1rem; }
.lede { color: var(--muted); font-size:1.125rem; max-width:34rem; }
.actions { display:flex; gap:1rem; margin-top:1.75rem; flex-wrap:wrap; }
.btn { background:var(--accent); color:#fff; padding:.75rem 1.1rem; border-radius:.5rem; text-decoration:none; font-weight:600; }
.ghost { color:var(--fg); padding:.75rem 1.1rem; }
.grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); padding:2rem; }
.grid article, .plans article { background:#141414; border:1px solid #222; border-radius:.75rem; padding:1.25rem; }
.pricing { padding:2rem; }
.plans { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); margin-top:1rem; }
.featured { border-color: var(--accent); }
.price { font-size:2rem; font-weight:700; margin:.35rem 0; }
.cta { margin:2rem; padding:2.5rem; border-radius:1rem; background:linear-gradient(135deg,#1a120c,#0a0a0a); text-align:center; }
""",
    },
    {
        "id": "portfolio-creative",
        "title": {"en": "Creative portfolio", "fr": "Portfolio créatif"},
        "description": {
            "en": "Project grid, bio and contact for freelancers.",
            "fr": "Grille de projets, bio et contact pour freelances.",
        },
        "tags": ["portfolio", "creative", "personal"],
        "bootHint": {
            "en": "Adapt this portfolio: replace projects, bio and contact details.",
            "fr": "Adapte ce portfolio : remplace projets, bio et coordonnées.",
        },
        "accent": "#7C5CFF",
        "bg": "#0f0e13",
        "fg": "#f7f5ff",
        "muted": "#a39bb8",
        "tone": "Artistic, confident, concise.",
        "app": """export default function App() {
  const works = ["Aurora Brand", "Kinetic Type", "Studio Atlas", "Night Market"];
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Designer / Art direction</p>
        <h1>Maya Chen</h1>
        <p className="lede">Visual systems for brands that want to feel alive.</p>
      </header>
      <section className="grid">
        {works.map((name) => (
          <article key={name}>
            <div className="thumb" />
            <h3>{name}</h3>
            <p>Brand identity · 2025</p>
          </article>
        ))}
      </section>
      <footer className="foot">
        <p>Based in Lisbon · available for select projects</p>
        <a href="mailto:hello@example.com">hello@example.com</a>
      </footer>
    </div>
  );
}
""",
        "css_extra": """
.hero { padding:3rem 2rem 1rem; }
.eyebrow { color:var(--accent); letter-spacing:.12em; text-transform:uppercase; font-size:.7rem; }
.hero h1 { font-size:clamp(2.8rem,8vw,5rem); margin:.4rem 0; letter-spacing:-.04em; }
.lede { color:var(--muted); max-width:28rem; }
.grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); padding:1.5rem 2rem 3rem; }
.grid article { background:#17151f; border-radius:1rem; overflow:hidden; border:1px solid #2a2540; }
.thumb { height:140px; background:linear-gradient(135deg,var(--accent),#1a1630); }
.grid h3, .grid p { margin:.4rem 1rem; }
.grid p { color:var(--muted); font-size:.9rem; margin-bottom:1rem; }
.foot { padding:0 2rem 3rem; display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; color:var(--muted); }
.foot a { color:var(--fg); }
""",
    },
    {
        "id": "docs-minimal",
        "title": {"en": "Minimal docs", "fr": "Docs minimal"},
        "description": {
            "en": "Sidebar docs layout with article content.",
            "fr": "Layout docs avec sidebar et contenu d’article.",
        },
        "tags": ["docs", "knowledge", "product"],
        "bootHint": {
            "en": "Turn this into your product docs: rename sections and fill content.",
            "fr": "Transforme ça en docs produit : renomme les sections et remplis le contenu.",
        },
        "accent": "#0EA5E9",
        "bg": "#f8fafc",
        "fg": "#0f172a",
        "muted": "#64748b",
        "tone": "Clear, technical, helpful.",
        "app": """export default function App() {
  const nav = ["Introduction", "Quickstart", "API", "Guides", "Changelog"];
  return (
    <div className="shell">
      <aside>
        <strong>Forge Docs</strong>
        <nav>
          {nav.map((item) => (
            <a key={item} href={`#${item}`}>{item}</a>
          ))}
        </nav>
      </aside>
      <main>
        <h1>Introduction</h1>
        <p className="lede">Learn how to integrate Forge into your product in minutes.</p>
        <h2>What you get</h2>
        <ul>
          <li>Hosted previews for every project</li>
          <li>Chat-driven edits with design charter</li>
          <li>Connectors for data and auth</li>
        </ul>
        <h2>Next step</h2>
        <p>Follow the Quickstart to create your first site.</p>
      </main>
    </div>
  );
}
""",
        "css_extra": """
.shell { display:grid; grid-template-columns:220px 1fr; min-height:100vh; }
aside { border-right:1px solid #e2e8f0; padding:1.5rem 1rem; background:#fff; }
aside strong { display:block; margin-bottom:1rem; }
aside a { display:block; color:var(--muted); text-decoration:none; padding:.45rem .6rem; border-radius:.4rem; margin-bottom:.2rem; }
aside a:hover { background:#f1f5f9; color:var(--fg); }
main { padding:2.5rem 2rem; max-width:46rem; }
.lede { color:var(--muted); font-size:1.1rem; }
h2 { margin-top:2rem; }
ul { color:var(--muted); line-height:1.7; }
@media (max-width:800px) { .shell { grid-template-columns:1fr; } aside { border-right:0; border-bottom:1px solid #e2e8f0; } }
""",
    },
    {
        "id": "dashboard-admin",
        "title": {"en": "Admin dashboard", "fr": "Dashboard admin"},
        "description": {
            "en": "Sidebar, KPI cards and a simple data table.",
            "fr": "Sidebar, cartes KPI et table de données simple.",
        },
        "tags": ["dashboard", "admin", "saas"],
        "bootHint": {
            "en": "Build on this admin shell: rename metrics, table columns and nav.",
            "fr": "Pars de ce shell admin : renomme métriques, colonnes et navigation.",
        },
        "accent": "#22C55E",
        "bg": "#0b1220",
        "fg": "#e8eef9",
        "muted": "#8b9bb4",
        "tone": "Operational, dense but readable.",
        "app": """export default function App() {
  const kpis = [
    { label: "MRR", value: "$48.2k" },
    { label: "Active", value: "1,284" },
    { label: "Churn", value: "2.1%" },
  ];
  const rows = [
    ["Acme", "Pro", "Active"],
    ["Northwind", "Starter", "Trial"],
    ["Globex", "Team", "Active"],
  ];
  return (
    <div className="shell">
      <aside>
        <strong>Pulse</strong>
        <a href="#">Overview</a>
        <a href="#">Customers</a>
        <a href="#">Billing</a>
        <a href="#">Settings</a>
      </aside>
      <main>
        <h1>Overview</h1>
        <div className="kpis">
          {kpis.map((k) => (
            <article key={k.label}>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
            </article>
          ))}
        </div>
        <table>
          <thead>
            <tr><th>Customer</th><th>Plan</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
""",
        "css_extra": """
.shell { display:grid; grid-template-columns:200px 1fr; min-height:100vh; }
aside { background:#0f172a; padding:1.25rem; border-right:1px solid #1e293b; display:flex; flex-direction:column; gap:.4rem; }
aside strong { margin-bottom:.75rem; }
aside a { color:var(--muted); text-decoration:none; padding:.45rem .55rem; border-radius:.4rem; }
aside a:hover { background:#1e293b; color:var(--fg); }
main { padding:1.5rem; }
.kpis { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); margin:1rem 0 1.5rem; }
.kpis article { background:#111827; border:1px solid #1f2937; border-radius:.75rem; padding:1rem; display:grid; gap:.35rem; }
.kpis span { color:var(--muted); font-size:.85rem; }
.kpis strong { font-size:1.5rem; color:var(--accent); }
table { width:100%; border-collapse:collapse; background:#111827; border-radius:.75rem; overflow:hidden; }
th, td { text-align:left; padding:.85rem 1rem; border-bottom:1px solid #1f2937; }
th { color:var(--muted); font-weight:500; font-size:.85rem; }
@media (max-width:800px) { .shell { grid-template-columns:1fr; } }
""",
    },
    {
        "id": "blog-magazine",
        "title": {"en": "Magazine blog", "fr": "Blog magazine"},
        "description": {
            "en": "Featured story plus article list layout.",
            "fr": "Article à la une et liste d’articles.",
        },
        "tags": ["blog", "content", "media"],
        "bootHint": {
            "en": "Customize this magazine blog: titles, categories and featured story.",
            "fr": "Personnalise ce blog magazine : titres, catégories et article à la une.",
        },
        "accent": "#E11D48",
        "bg": "#fffaf5",
        "fg": "#1c1917",
        "muted": "#78716c",
        "tone": "Editorial, warm, storytelling.",
        "app": """export default function App() {
  const posts = [
    { cat: "Product", title: "Why shipping weekly beats big launches" },
    { cat: "Design", title: "Charters that keep AI on-brand" },
    { cat: "Ops", title: "Runbooks for async teams" },
  ];
  return (
    <div className="page">
      <header className="top">
        <strong>Field Notes</strong>
        <nav><a href="#">Latest</a><a href="#">Topics</a><a href="#">About</a></nav>
      </header>
      <section className="featured">
        <p className="cat">Cover</p>
        <h1>Building calm software in a noisy market</h1>
        <p>A practical guide to focus, craft and durable product loops.</p>
      </section>
      <section className="list">
        {posts.map((p) => (
          <article key={p.title}>
            <span>{p.cat}</span>
            <h3>{p.title}</h3>
          </article>
        ))}
      </section>
    </div>
  );
}
""",
        "css_extra": """
.top { display:flex; justify-content:space-between; padding:1.25rem 2rem; border-bottom:1px solid #e7e5e4; }
.top a { margin-left:1rem; color:var(--muted); text-decoration:none; }
.featured { padding:3rem 2rem; max-width:48rem; }
.cat, .list span { color:var(--accent); text-transform:uppercase; letter-spacing:.08em; font-size:.7rem; font-weight:700; }
.featured h1 { font-size:clamp(2.2rem,5vw,3.4rem); letter-spacing:-.03em; margin:.5rem 0 1rem; }
.featured p { color:var(--muted); max-width:36rem; }
.list { display:grid; gap:1rem; padding:0 2rem 3rem; }
.list article { padding:1.1rem 0; border-top:1px solid #e7e5e4; }
.list h3 { margin:.35rem 0 0; font-size:1.25rem; }
""",
    },
    {
        "id": "ecommerce-product",
        "title": {"en": "Product storefront", "fr": "Fiche produit"},
        "description": {
            "en": "Product page with gallery, price and cart UI.",
            "fr": "Page produit avec galerie, prix et UI panier.",
        },
        "tags": ["ecommerce", "product", "shop"],
        "bootHint": {
            "en": "Adapt product name, price, variants and cart copy.",
            "fr": "Adapte nom produit, prix, variantes et textes du panier.",
        },
        "accent": "#111111",
        "bg": "#f5f5f4",
        "fg": "#111111",
        "muted": "#57534e",
        "tone": "Retail, clean, conversion-oriented.",
        "app": """export default function App() {
  return (
    <div className="page">
      <header className="bar">
        <strong>Atelier</strong>
        <button type="button">Cart (1)</button>
      </header>
      <section className="product">
        <div className="gallery" />
        <div className="info">
          <p className="eyebrow">New arrival</p>
          <h1>Ceramic pour-over set</h1>
          <p className="price">$86</p>
          <p className="desc">Matte stoneware dripper with matching carafe. Handmade in small batches.</p>
          <div className="variants">
            <button type="button" className="active">Sand</button>
            <button type="button">Ink</button>
            <button type="button">Clay</button>
          </div>
          <button type="button" className="buy">Add to cart</button>
        </div>
      </section>
    </div>
  );
}
""",
        "css_extra": """
.bar { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.5rem; background:#fff; border-bottom:1px solid #e7e5e4; }
.bar button { border:1px solid #d6d3d1; background:#fff; padding:.45rem .8rem; border-radius:.4rem; }
.product { display:grid; grid-template-columns:1.1fr 1fr; gap:2rem; padding:2rem 1.5rem; max-width:980px; margin:0 auto; }
.gallery { min-height:360px; border-radius:1rem; background:linear-gradient(145deg,#d6d3d1,#a8a29e); }
.eyebrow { text-transform:uppercase; letter-spacing:.1em; font-size:.7rem; color:var(--muted); }
.info h1 { font-size:clamp(1.8rem,4vw,2.6rem); margin:.4rem 0; letter-spacing:-.03em; }
.price { font-size:1.4rem; font-weight:700; }
.desc { color:var(--muted); line-height:1.6; }
.variants { display:flex; gap:.5rem; margin:1.25rem 0; }
.variants button { border:1px solid #d6d3d1; background:#fff; padding:.5rem .85rem; border-radius:.4rem; }
.variants .active { border-color:var(--accent); }
.buy { width:100%; background:var(--accent); color:#fff; border:0; padding:.9rem 1rem; border-radius:.5rem; font-weight:600; }
@media (max-width:800px) { .product { grid-template-columns:1fr; } }
""",
    },
    {
        "id": "agency-services",
        "title": {"en": "Agency services", "fr": "Agence services"},
        "description": {
            "en": "Services, process and testimonials for studios.",
            "fr": "Services, process et témoignages pour studios.",
        },
        "tags": ["agency", "services", "b2b"],
        "bootHint": {
            "en": "Rewrite services, process steps and client quotes for your agency.",
            "fr": "Réécris services, étapes de process et citations clients pour ton agence.",
        },
        "accent": "#CA8A04",
        "bg": "#09090b",
        "fg": "#fafafa",
        "muted": "#a1a1aa",
        "tone": "Premium, confident, concise.",
        "app": """export default function App() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Product studio</p>
        <h1>We design and ship revenue-critical interfaces</h1>
        <p className="lede">Strategy, UX and front-end for teams who need craft at speed.</p>
      </section>
      <section className="services">
        {["Discovery", "Design systems", "Build & launch"].map((s) => (
          <article key={s}><h3>{s}</h3><p>Focused engagements with clear outcomes.</p></article>
        ))}
      </section>
      <section className="quote">
        <blockquote>“They turned a messy backlog into a product customers understand.”</blockquote>
        <cite>— Head of Product, Northline</cite>
      </section>
    </div>
  );
}
""",
        "css_extra": """
.hero { padding:4rem 2rem 2rem; max-width:48rem; }
.eyebrow { color:var(--accent); letter-spacing:.12em; text-transform:uppercase; font-size:.72rem; }
.hero h1 { font-size:clamp(2.2rem,5vw,3.6rem); letter-spacing:-.03em; margin:.6rem 0 1rem; }
.lede { color:var(--muted); }
.services { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); padding:1rem 2rem 2rem; }
.services article { border:1px solid #27272a; border-radius:.85rem; padding:1.2rem; background:#111113; }
.services p { color:var(--muted); }
.quote { margin:1rem 2rem 3rem; padding:2rem; border-left:3px solid var(--accent); background:#111113; }
blockquote { margin:0; font-size:1.25rem; line-height:1.5; }
cite { display:block; margin-top:1rem; color:var(--muted); font-style:normal; }
""",
    },
    {
        "id": "waitlist-launch",
        "title": {"en": "Waitlist launch", "fr": "Waitlist lancement"},
        "description": {
            "en": "Coming-soon page with email capture UI.",
            "fr": "Page coming soon avec capture d’email.",
        },
        "tags": ["waitlist", "launch", "marketing"],
        "bootHint": {
            "en": "Customize product name, promise and waitlist CTA.",
            "fr": "Personnalise nom produit, promesse et CTA waitlist.",
        },
        "accent": "#06B6D4",
        "bg": "#020617",
        "fg": "#f8fafc",
        "muted": "#94a3b8",
        "tone": "Anticipation, bold, minimal.",
        "app": """export default function App() {
  return (
    <div className="page center">
      <p className="eyebrow">Launching soon</p>
      <h1>Orbit</h1>
      <p className="lede">The calendar that plans your week for you.</p>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="you@company.com" aria-label="Email" />
        <button type="submit">Join waitlist</button>
      </form>
      <p className="meta">2,418 builders already in line</p>
    </div>
  );
}
""",
        "css_extra": """
.center { min-height:100vh; display:grid; place-content:center; text-align:center; gap:1rem; padding:2rem; background:
  radial-gradient(circle at 50% 20%, rgba(6,182,212,.18), transparent 45%), var(--bg); }
.eyebrow { color:var(--accent); letter-spacing:.14em; text-transform:uppercase; font-size:.72rem; }
h1 { font-size:clamp(3rem,10vw,5rem); margin:0; letter-spacing:-.04em; }
.lede { color:var(--muted); margin:0 auto; max-width:24rem; }
.form { display:flex; gap:.5rem; justify-content:center; flex-wrap:wrap; margin-top:.5rem; }
.form input { min-width:220px; padding:.8rem 1rem; border-radius:.5rem; border:1px solid #1e293b; background:#0b1220; color:var(--fg); }
.form button { background:var(--accent); color:#041016; border:0; border-radius:.5rem; padding:.8rem 1rem; font-weight:700; }
.meta { color:var(--muted); font-size:.9rem; }
""",
    },
    {
        "id": "restaurant-menu",
        "title": {"en": "Restaurant menu", "fr": "Menu restaurant"},
        "description": {
            "en": "Menu sections and reservation CTA.",
            "fr": "Sections de menu et CTA réservation.",
        },
        "tags": ["restaurant", "menu", "local"],
        "bootHint": {
            "en": "Replace dishes, prices and reservation details for the venue.",
            "fr": "Remplace plats, prix et infos de réservation pour l’établissement.",
        },
        "accent": "#B45309",
        "bg": "#1c1917",
        "fg": "#fafaf9",
        "muted": "#a8a29e",
        "tone": "Warm hospitality, appetizing, local.",
        "app": """export default function App() {
  const items = [
    { name: "Tomato toast", price: "9", note: "ricotta, basil oil" },
    { name: "Catch of the day", price: "24", note: "citrus butter" },
    { name: "Olive oil cake", price: "8", note: "seasonal fruit" },
  ];
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Downtown · Dinner</p>
        <h1>Maison Rue</h1>
        <p className="lede">Seasonal plates, open kitchen, quiet evenings.</p>
        <a className="btn" href="#reserve">Reserve a table</a>
      </header>
      <section className="menu">
        <h2>Tonight</h2>
        {items.map((item) => (
          <article key={item.name}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.note}</p>
            </div>
            <strong>{item.price}</strong>
          </article>
        ))}
      </section>
      <section id="reserve" className="reserve">
        <h2>Reservations</h2>
        <p>Wed–Sun · 18:00–22:30 · +33 1 00 00 00 00</p>
      </section>
    </div>
  );
}
""",
        "css_extra": """
.hero { padding:3.5rem 2rem 1.5rem; text-align:center; }
.eyebrow { color:var(--accent); letter-spacing:.14em; text-transform:uppercase; font-size:.7rem; }
.hero h1 { font-family:Georgia, serif; font-size:clamp(2.8rem,8vw,4.5rem); margin:.4rem 0; font-weight:500; }
.lede { color:var(--muted); }
.btn { display:inline-block; margin-top:1.25rem; background:var(--accent); color:#fff; text-decoration:none; padding:.7rem 1.1rem; border-radius:.4rem; }
.menu { max-width:34rem; margin:0 auto; padding:1rem 1.5rem 2rem; }
.menu h2, .reserve h2 { font-family:Georgia, serif; font-weight:500; }
.menu article { display:flex; justify-content:space-between; gap:1rem; padding:1rem 0; border-bottom:1px solid #292524; }
.menu p { color:var(--muted); margin:.25rem 0 0; }
.reserve { text-align:center; padding:0 1.5rem 3rem; color:var(--muted); }
""",
    },
    {
        "id": "event-conference",
        "title": {"en": "Conference event", "fr": "Événement conférence"},
        "description": {
            "en": "Agenda, speakers and ticket CTA.",
            "fr": "Agenda, speakers et CTA billets.",
        },
        "tags": ["event", "conference", "agenda"],
        "bootHint": {
            "en": "Update event name, agenda slots, speakers and ticket CTA.",
            "fr": "Mets à jour nom d’événement, agenda, speakers et CTA billets.",
        },
        "accent": "#4F46E5",
        "bg": "#eef2ff",
        "fg": "#1e1b4b",
        "muted": "#6366f1",
        "tone": "Energetic, community, clear hierarchy.",
        "app": """export default function App() {
  const talks = [
    { time: "09:30", title: "Opening keynote", who: "Amina Rao" },
    { time: "11:00", title: "AI that ships", who: "Leo Park" },
    { time: "14:00", title: "Design systems at scale", who: "Sofia Mendes" },
  ];
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">May 12 · Paris</p>
        <h1>Builders Summit</h1>
        <p className="lede">One day of product craft, AI workflows and shipping stories.</p>
        <a className="btn" href="#tickets">Get tickets</a>
      </header>
      <section className="agenda">
        <h2>Agenda</h2>
        {talks.map((t) => (
          <article key={t.time}>
            <time>{t.time}</time>
            <div>
              <h3>{t.title}</h3>
              <p>{t.who}</p>
            </div>
          </article>
        ))}
      </section>
      <section id="tickets" className="tickets">
        <h2>Tickets</h2>
        <p>Early bird · €149</p>
        <a className="btn" href="#">Buy pass</a>
      </section>
    </div>
  );
}
""",
        "css_extra": """
.hero { padding:3rem 2rem; background:linear-gradient(160deg,#c7d2fe,#eef2ff 60%); }
.eyebrow { letter-spacing:.1em; text-transform:uppercase; font-size:.72rem; font-weight:700; }
.hero h1 { font-size:clamp(2.4rem,6vw,4rem); margin:.5rem 0; letter-spacing:-.03em; }
.lede { max-width:34rem; color:#4338ca; }
.btn { display:inline-block; margin-top:1rem; background:var(--accent); color:#fff; text-decoration:none; padding:.75rem 1.1rem; border-radius:.55rem; font-weight:600; }
.agenda, .tickets { padding:2rem; max-width:40rem; }
.agenda article { display:grid; grid-template-columns:70px 1fr; gap:1rem; padding:1rem 0; border-bottom:1px solid #c7d2fe; }
time { font-weight:700; color:var(--accent); }
.agenda p { margin:.2rem 0 0; color:#6366f1; }
.tickets { background:#fff; margin:0 2rem 2rem; border-radius:1rem; border:1px solid #c7d2fe; }
""",
    },
]


def base_css(bg: str, fg: str, muted: str, accent: str, extra: str) -> str:
    return f""":root {{
  color-scheme: {"dark" if bg.startswith("#0") or bg in {"#09090b", "#020617", "#1c1917", "#0b1220", "#0f0e13"} else "light"};
  --bg: {bg};
  --fg: {fg};
  --muted: {muted};
  --accent: {accent};
  font-family: "Segoe UI", system-ui, sans-serif;
}}

* {{ box-sizing: border-box; }}

body {{
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}}

h1, h2, h3 {{ margin-top: 0; }}
p {{ margin-top: 0; }}
{extra}
"""


def design_md(meta: dict) -> str:
    return f"""# Design charter

This file is the graphic charter for the app. Forge injects it into every AI call.

## Template
- id: `{meta["id"]}`
- name: {meta["title"]["en"]}

## Colors
- `--bg`: {meta["bg"]}
- `--fg`: {meta["fg"]}
- `--muted`: {meta["muted"]}
- `--accent`: {meta["accent"]}

## Typography
- Sans UI for product surfaces; serif allowed only when already used in this template.

## Tone
- {meta["tone"]}

## Logo
- Placeholder wordmark only — replace via Charte graphique / prompt.

## Do / Don't
- Do keep CSS variables and section structure.
- Do adapt copy, imagery and brand details via chat.
- Don't invent a second palette unless the user asks.
"""


def write_template(meta: dict) -> None:
    dest = ROOT / meta["id"]
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "src").mkdir(exist_ok=True)
    (dest / "public").mkdir(exist_ok=True)

    tpl = {
        "id": meta["id"],
        "title": meta["title"],
        "description": meta["description"],
        "tags": meta["tags"],
        "preview": None,
        "bootHint": meta["bootHint"],
        "accent": meta["accent"],
        "bg": meta["bg"],
    }
    (dest / "template.json").write_text(json.dumps(tpl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (dest / "package.json").write_text(PACKAGE_JSON % meta["id"], encoding="utf-8")
    (dest / "vite.config.ts").write_text(VITE_CONFIG, encoding="utf-8")
    (dest / "tsconfig.json").write_text(TSCONFIG, encoding="utf-8")
    (dest / "tsconfig.node.json").write_text(TSCONFIG_NODE, encoding="utf-8")
    title = meta["title"]["en"]
    (dest / "index.html").write_text(
        f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
""",
        encoding="utf-8",
    )
    (dest / "src" / "main.tsx").write_text(MAIN_TSX, encoding="utf-8")
    (dest / "src" / "App.tsx").write_text(meta["app"], encoding="utf-8")
    (dest / "src" / "index.css").write_text(
        base_css(meta["bg"], meta["fg"], meta["muted"], meta["accent"], meta["css_extra"]),
        encoding="utf-8",
    )
    (dest / "src" / "vite-env.d.ts").write_text(VITE_ENV, encoding="utf-8")
    (dest / "DESIGN.md").write_text(design_md(meta), encoding="utf-8")
    (dest / "public" / ".gitkeep").write_text("", encoding="utf-8")
    print(f"wrote {meta['id']}")


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    assert len(TEMPLATES) == 10, len(TEMPLATES)
    for meta in TEMPLATES:
        write_template(meta)
    print(f"OK {len(TEMPLATES)} templates -> {ROOT}")


if __name__ == "__main__":
    main()
