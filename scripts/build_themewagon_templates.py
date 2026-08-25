#!/usr/bin/env python3
"""Build the 6 ThemeWagon-inspired Forge templates with downloaded assets."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "data" / "templates"
MEDIA = TEMPLATES / "_media" / "themewagon"

OLD = {
    "agency-services",
    "blog-magazine",
    "dashboard-admin",
    "docs-minimal",
    "ecommerce-product",
    "event-conference",
    "landing-saas",
    "portfolio-creative",
    "restaurant-menu",
    "waitlist-launch",
}

PACKAGE = """{
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

VITE = """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true },
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

MAIN = """import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"""


def copy_media(slug: str, dest_public: Path, rename_map: dict[str, str] | None = None) -> list[str]:
    src = MEDIA / slug
    dest_public.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    if not src.is_dir():
        return copied
    for f in sorted(src.iterdir()):
        if f.name == "manifest.json" or not f.is_file():
            continue
        name = rename_map.get(f.name, f.name) if rename_map else f.name
        shutil.copy2(f, dest_public / name)
        copied.append(name)
    return copied


def write_base(dest: Path, tid: str, title: str) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "src").mkdir(exist_ok=True)
    (dest / "public").mkdir(exist_ok=True)
    (dest / "package.json").write_text(PACKAGE % tid, encoding="utf-8")
    (dest / "vite.config.ts").write_text(VITE, encoding="utf-8")
    (dest / "tsconfig.json").write_text(TSCONFIG, encoding="utf-8")
    (dest / "tsconfig.node.json").write_text(
        '{\n  "compilerOptions": { "composite": true, "skipLibCheck": true, "module": "ESNext", "moduleResolution": "bundler", "allowSyntheticDefaultImports": true },\n  "include": ["vite.config.ts"]\n}\n',
        encoding="utf-8",
    )
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
    (dest / "src" / "main.tsx").write_text(MAIN, encoding="utf-8")
    (dest / "src" / "vite-env.d.ts").write_text('/// <reference types="vite/client" />\n', encoding="utf-8")


def write_meta(dest: Path, meta: dict) -> None:
    (dest / "template.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (dest / "DESIGN.md").write_text(
        f"""# Design charter

Inspired by ThemeWagon demo — keep layout, palette and section rhythm.

## Template
- id: `{meta["id"]}`
- name: {meta["title"]["en"]}

## Colors
- `--bg`: {meta["bg"]}
- `--fg`: {meta.get("fg", "#111")}
- `--muted`: {meta.get("muted", "#666")}
- `--accent`: {meta["accent"]}

## Tone
- {meta.get("tone", "Faithful to the original demo.")}

## Do / Don't
- Do keep structure and spacing close to the demo.
- Do reuse images from `/public`.
- Don't invent a second palette.
""",
        encoding="utf-8",
    )


def write_preview(dest: Path, title: str, css: str, body: str) -> None:
    (dest / "preview.html").write_text(
        f"""<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<style>
{css}
html,body{{overflow:hidden}} a,button{{pointer-events:none}}
img{{max-width:100%;display:block}}
</style></head><body>
{body}
</body></html>
""",
        encoding="utf-8",
    )


# ——— SARAB ———
SARAB_CSS = """
:root{--bg:#fff8f3;--fg:#1a1a1a;--muted:#6b7280;--accent:#e11d2e;--orange:#f2620a;--card:#fff;--border:#f3e7df;
font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
a{color:inherit;text-decoration:none}
.top{background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.5rem;gap:1rem;position:sticky;top:0;z-index:5}
.brand{display:flex;align-items:center;gap:.65rem;font-family:Georgia,serif;font-size:1.35rem;font-weight:700}
.logo{width:2.2rem;height:2.2rem;border-radius:999px;background:var(--orange);display:grid;place-items:center;color:#fff;font-size:.85rem}
.nav{display:flex;gap:1rem;flex-wrap:wrap;color:var(--muted);font-size:.9rem}
.btn{background:var(--accent);color:#fff;border:0;border-radius:999px;padding:.7rem 1.1rem;font-weight:700;cursor:pointer}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:2rem;padding:2.5rem 1.5rem;align-items:center;max-width:1100px;margin:0 auto}
.eyebrow{color:var(--orange);font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.75rem}
.hero h1{font-family:Georgia,serif;font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.1;margin:.4rem 0 1rem}
.hero p{color:var(--muted);max-width:34rem}
.actions{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.25rem}
.ghost{background:#fff;border:1px solid var(--border);color:var(--fg);border-radius:999px;padding:.7rem 1.1rem;font-weight:600}
.hero-card{background:#fff;border-radius:1.25rem;overflow:hidden;box-shadow:0 20px 50px rgba(225,29,46,.12)}
.hero-card img{width:100%;height:280px;object-fit:cover}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;max-width:1100px;margin:0 auto;padding:0 1.5rem 2rem}
.stats article{background:#fff;border-radius:1rem;padding:1rem;border:1px solid var(--border)}
.stats strong{display:block;font-size:1.4rem;color:var(--accent)}
.section{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.section h2{font-family:Georgia,serif;font-size:clamp(1.6rem,3vw,2.2rem);margin:0 0 .5rem}
.section > p{color:var(--muted);margin:0 0 1.25rem}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.card{background:#fff;border-radius:1rem;overflow:hidden;border:1px solid var(--border);box-shadow:0 8px 24px rgba(0,0,0,.04)}
.card img{width:100%;height:160px;object-fit:cover}
.card .body{padding:1rem}
.cat{color:var(--orange);font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.price{color:var(--accent);font-weight:800;font-size:1.15rem}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:.75rem}
.plus{width:2.2rem;height:2.2rem;border-radius:999px;background:var(--accent);color:#fff;border:0;font-size:1.2rem}
.offer{display:grid;grid-template-columns:1.1fr .9fr;gap:1.5rem;background:#1a1a1a;color:#fff;border-radius:1.25rem;overflow:hidden;margin:1.5rem}
.offer .txt{padding:2rem}
.offer img{width:100%;height:100%;min-height:240px;object-fit:cover}
@media(max-width:900px){.hero,.offer,.grid3,.stats{grid-template-columns:1fr}}
"""

SARAB_APP = """export default function App() {
  const menu = [
    { img: "/01-1.jpg", cat: "Burgers", title: "Classic Smash Burger", desc: "Double smashed patty, cheddar, caramelized onions & special sauce", price: "$14.99" },
    { img: "/02-2.jpg", cat: "Pizza", title: "Margherita Royale", desc: "San Marzano tomatoes, buffalo mozzarella, basil & truffle oil", price: "$19.99" },
    { img: "/03-3.jpg", cat: "Chicken", title: "Nashville Hot Chicken", desc: "Crispy fried chicken in fiery spice blend with honey drizzle", price: "$12.99" },
    { img: "/04-4.jpg", cat: "Wraps", title: "Loaded Fajita Wrap", desc: "Grilled chicken, peppers, sour cream & guacamole", price: "$10.99" },
    { img: "/05-5.jpg", cat: "Desserts", title: "Nutella Lava Cake", desc: "Molten chocolate cake with Nutella center & vanilla ice cream", price: "$8.99" },
    { img: "/06-6.jpg", cat: "Pasta", title: "Truffle Mushroom Pasta", desc: "Tagliatelle, wild mushrooms, black truffle & parmesan", price: "$16.99" },
  ];
  return (
    <div>
      <header className="top">
        <div className="brand"><span className="logo">S</span><div>Sarab<br /><small style={{fontFamily:"system-ui",fontSize:10,color:"#6b7280",letterSpacing:".08em"}}>FAST FOOD &amp; RESTAURANT</small></div></div>
        <nav className="nav"><a href="#menu">Menu</a><a href="#about">About</a><a href="#offer">Offers</a><a href="#contact">Contact</a></nav>
        <button className="btn" type="button">Order Now</button>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">#1 Rated Fast Food in New York</p>
          <h1>Delicious Fast Food for Every Moment</h1>
          <p>Experience bold flavors crafted from premium ingredients. From crispy burgers to gourmet pizzas — every bite is an adventure.</p>
          <div className="actions"><button className="btn" type="button">Explore Menu</button><button className="ghost" type="button">Watch Our Story</button></div>
        </div>
        <div className="hero-card"><img src="/07-banner-img.jpg" alt="Sarab burger" /></div>
      </section>
      <div className="stats">
        {[["850+","Happy Customers"],["120+","Menu Items"],["15+","Expert Chefs"],["12 yr","Experience"]].map(([v,l]) => (
          <article key={l}><strong>{v}</strong><span style={{color:"#6b7280"}}>{l}</span></article>
        ))}
      </div>
      <section className="section" id="menu">
        <h2>Our Delicious Menu</h2>
        <p>Hand-crafted plates ready for dine-in or delivery.</p>
        <div className="grid3">
          {menu.map((m) => (
            <article className="card" key={m.title}>
              <img src={m.img} alt={m.title} />
              <div className="body">
                <div className="cat">{m.cat}</div>
                <h3 style={{margin:".35rem 0",fontFamily:"Georgia,serif"}}>{m.title}</h3>
                <p style={{color:"#6b7280",fontSize:".9rem",margin:0}}>{m.desc}</p>
                <div className="row"><span className="price">{m.price}</span><button className="plus" type="button">+</button></div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section" id="about">
        <h2>We Invite You to Visit</h2>
        <p>Founded in 2012, Sarab began as a small corner joint with a big dream — food that brings people together.</p>
        <div className="grid3">
          <article className="card"><img src="/14-about1.jpg" alt="Restaurant" /><div className="body"><h3>100% Fresh Ingredients</h3><p style={{color:"#6b7280"}}>Hand-picked daily for maximum freshness.</p></div></article>
          <article className="card"><img src="/15-about2.jpg" alt="Kitchen" /><div className="body"><h3>Award-Winning Recipes</h3><p style={{color:"#6b7280"}}>Signature dishes loved across the city.</p></div></article>
          <article className="card"><img src="/16-off-img.jpg" alt="Deal" /><div className="body"><h3>Lightning Delivery</h3><p style={{color:"#6b7280"}}>Hot food at your door in under 25 minutes.</p></div></article>
        </div>
      </section>
      <section className="offer" id="offer">
        <div className="txt">
          <p className="eyebrow" style={{color:"#fca5a5"}}>Limited Time Offer</p>
          <h2 style={{fontFamily:"Georgia,serif",fontSize:"2rem"}}>Get 30% Off Our Signature Burger Meal</h2>
          <p style={{opacity:.8}}>Weekend special — signature burger, loaded fries and a premium shake.</p>
          <button className="btn" type="button" style={{marginTop:"1rem"}}>Grab the Deal</button>
        </div>
        <img src="/16-off-img.jpg" alt="Offer" />
      </section>
      <footer className="section" id="contact" style={{paddingBottom:"3rem"}}>
        <h2>Sarab</h2>
        <p>42 Flavor Street, NY · +1 (800) 123-4567 · hello@sarabfood.com</p>
      </footer>
    </div>
  );
}
"""

SARAB_PREVIEW = """
<header class="top"><div class="brand"><span class="logo">S</span>Sarab</div><button class="btn">Order Now</button></header>
<section class="hero"><div><p class="eyebrow">#1 Rated</p><h1>Delicious Fast Food for Every Moment</h1><p>Bold flavors from premium ingredients.</p></div>
<div class="hero-card"><img src="07-banner-img.jpg" alt=""/></div></section>
"""


# ——— BLOOM ———
BLOOM_CSS = """
:root{--bg:#f7f7f5;--fg:#111;--muted:#6b7280;--accent:#111;--card:#fff;font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
.top{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;background:#fff;border-bottom:1px solid #eee}
.brand{font-weight:800;letter-spacing:.04em}
.hero{padding:3rem 1.5rem 1.5rem;max-width:1100px;margin:0 auto;text-align:center}
.hero h1{font-size:clamp(2.4rem,6vw,4rem);margin:.4rem 0;letter-spacing:-.03em}
.hero p{color:var(--muted);max-width:34rem;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;max-width:1100px;margin:0 auto;padding:1.5rem}
.card{background:#fff;border-radius:1rem;overflow:hidden;border:1px solid #eee}
.card img{width:100%;height:180px;object-fit:cover;background:#eee}
.card .body{padding:1rem}
.price{font-weight:800}
.btn{width:100%;margin-top:.75rem;background:#111;color:#fff;border:0;border-radius:.6rem;padding:.7rem;font-weight:700}
.news{max-width:640px;margin:2rem auto 3rem;background:#111;color:#fff;border-radius:1rem;padding:2rem;text-align:center}
"""

BLOOM_APP = """const products = [
  { img: "/01-photo-1579338559194-a162d19bf842.jpg", name: "AirFlex Runner", price: "$89" },
  { img: "/02-photo-1608667508764-33cf0726b13a.jpg", name: "Urban Street Pro", price: "$99" },
  { img: "/03-photo-1465453869711-7e174808ace9.jpg", name: "Classic Court 90s", price: "$79" },
  { img: "/04-photo-1512374382149-233c42b6a83b.jpg", name: "Volt Edge", price: "$119" },
  { img: "/05-photo-1608231387042-66d1773070a5.jpg", name: "Zenith Flow", price: "$129" },
  { img: "/06-photo-1511556532299-8f662fc26c06.jpg", name: "Street Vibe Low", price: "$69" },
  { img: "/07-photo-1516767254874-281bffac9e9a.jpg", name: "Nova Horizon", price: "$109" },
  { img: "/08-photo-1560769629-975ec94e6a86.jpg", name: "Pulse React", price: "$99" },
];

export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">BLOOMSHOP</strong><nav style={{display:"flex",gap:"1rem",color:"#6b7280"}}><a href="#">Contact</a><a href="#">Sign In</a></nav></header>
      <section className="hero">
        <h1>Step Into Style</h1>
        <p>Discover our latest collection of premium sneakers — comfort, design, and performance in every pair.</p>
      </section>
      <section className="grid">
        {products.map((p) => (
          <article className="card" key={p.name}>
            <img src={p.img} alt={p.name} />
            <div className="body">
              <h3 style={{margin:"0 0 .35rem",fontSize:"1rem"}}>{p.name}</h3>
              <div className="price">{p.price}.00</div>
              <button className="btn" type="button">Add to Cart</button>
            </div>
          </article>
        ))}
      </section>
      <section className="news">
        <h2 style={{marginTop:0}}>Stay in the loop</h2>
        <p style={{opacity:.75}}>Subscribe for exclusive offers and new arrivals.</p>
        <button className="btn" type="button" style={{background:"#fff",color:"#111",maxWidth:220,margin:"1rem auto 0"}}>Subscribe</button>
      </section>
    </div>
  );
}
"""

BLOOM_PREVIEW = """
<header class="top"><strong class="brand">BLOOMSHOP</strong></header>
<section class="hero"><h1>Step Into Style</h1><p>Premium sneakers for every stride.</p></section>
<section class="grid"><article class="card"><img src="01-photo-1579338559194-a162d19bf842.jpg" alt=""/><div class="body"><h3>AirFlex Runner</h3><div class="price">$89.00</div></div></article>
<article class="card"><img src="02-photo-1608667508764-33cf0726b13a.jpg" alt=""/><div class="body"><h3>Urban Street Pro</h3><div class="price">$99.00</div></div></article>
<article class="card"><img src="04-photo-1512374382149-233c42b6a83b.jpg" alt=""/><div class="body"><h3>Volt Edge</h3><div class="price">$119.00</div></div></article></section>
"""


# ——— FOLIO ———
FOLIO_CSS = """
:root{--bg:#0b0b0c;--fg:#f5f5f5;--muted:#a1a1aa;--accent:#a3e635;font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
.top{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #222}
.brand{font-weight:800;letter-spacing:-.03em}
.nav{display:flex;gap:1rem;color:var(--muted);font-size:.9rem}
.btn{background:var(--accent);color:#111;border:0;border-radius:999px;padding:.65rem 1rem;font-weight:800}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:2rem;padding:3rem 1.5rem;max-width:1100px;margin:0 auto;align-items:center}
.badge{display:inline-flex;gap:.4rem;align-items:center;border:1px solid #333;border-radius:999px;padding:.3rem .7rem;color:var(--muted);font-size:.8rem}
.dot{width:.5rem;height:.5rem;border-radius:999px;background:var(--accent)}
.hero h1{font-size:clamp(2.4rem,6vw,4rem);letter-spacing:-.04em;margin:.8rem 0}
.hero p{color:var(--muted);max-width:32rem}
.hero img{width:100%;border-radius:1.25rem;object-fit:cover;max-height:420px}
.stats{display:flex;gap:2rem;margin-top:1.5rem}
.stats strong{display:block;font-size:1.5rem}
.section{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.section h2{font-size:clamp(1.6rem,3vw,2.2rem);letter-spacing:-.03em}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.card{background:#141416;border:1px solid #242427;border-radius:1rem;overflow:hidden}
.card img{width:100%;height:150px;object-fit:cover}
.card .body{padding:1rem}
.muted{color:var(--muted)}
@media(max-width:900px){.hero,.grid3{grid-template-columns:1fr}}
"""

FOLIO_APP = """export default function App() {
  const works = [
    { img: "/02-photo-1551650975-87deedd944c3.jpg", title: "Novu — SaaS Dashboard", tags: "SaaS · Figma · Tailwind" },
    { img: "/03-photo-1460925895917-afdab827c52f.jpg", title: "Finlo — Fintech App", tags: "Fintech · Landing" },
    { img: "/04-photo-1618005182384-a83a8bd57fbe.jpg", title: "Orea — Creative Agency", tags: "Agency · Animation" },
  ];
  return (
    <div>
      <header className="top">
        <strong className="brand">eliott</strong>
        <nav className="nav"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
        <button className="btn" type="button">Hire me</button>
      </header>
      <section className="hero">
        <div>
          <span className="badge"><span className="dot" />Available for work</span>
          <h1>Hi, I'm Eliott</h1>
          <p>Freelance UI/UX Designer &amp; Frontend Developer. I design and build digital products people love — fast, clean, accessible.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">View my work</button>
            <button type="button" style={{background:"transparent",border:"1px solid #333",color:"#fff",borderRadius:999,padding:".65rem 1rem"}}>Get in touch</button>
          </div>
          <div className="stats">
            <div><strong>34+</strong><span className="muted">Projects</span></div>
            <div><strong>21+</strong><span className="muted">Clients</span></div>
            <div><strong>5y</strong><span className="muted">Experience</span></div>
          </div>
        </div>
        <img src="/01-photo-1507003211169-0a1dd7228f2d.jpg" alt="Eliott" />
      </section>
      <section className="section" id="work">
        <p className="muted">Portfolio</p>
        <h2>Selected work</h2>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {works.map((w) => (
            <article className="card" key={w.title}>
              <img src={w.img} alt={w.title} />
              <div className="body">
                <div className="muted" style={{fontSize:".8rem"}}>{w.tags}</div>
                <h3 style={{margin:".35rem 0"}}>{w.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section" id="about">
        <p className="muted">About me</p>
        <h2>A bit about who I am</h2>
        <p className="muted" style={{maxWidth:"40rem"}}>Based in Paris with 5 years shipping products for startups and agencies across Europe. Great interfaces get out of the way.</p>
      </section>
      <footer className="section" id="contact" style={{paddingBottom:"3rem"}}>
        <h2>Let's work together</h2>
        <p className="muted">hello@eliott.dev</p>
      </footer>
    </div>
  );
}
"""

FOLIO_PREVIEW = """
<header class="top"><strong class="brand">eliott</strong><button class="btn">Hire me</button></header>
<section class="hero"><div><span class="badge"><span class="dot"></span>Available</span><h1>Hi, I'm Eliott</h1><p>UI/UX Designer & Frontend Developer.</p></div>
<img src="01-photo-1507003211169-0a1dd7228f2d.jpg" alt=""/></section>
"""


# ——— TAILNEXT ———
TAIL_CSS = """
:root{--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--accent:#4f46e5;--soft:#eef2ff;font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
.top{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e2e8f0}
.brand{font-weight:800;color:var(--accent)}
.btn{background:var(--accent);color:#fff;border:0;border-radius:.7rem;padding:.7rem 1.1rem;font-weight:700}
.hero{display:grid;grid-template-columns:1fr 1fr;gap:2rem;max-width:1100px;margin:0 auto;padding:3rem 1.5rem;align-items:center}
.hero h1{font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.03em;margin:.5rem 0 1rem}
.hero p{color:var(--muted)}
.hero img{width:100%;border-radius:1rem}
.logos{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:1.5rem}
.logos img{height:28px;width:auto}
.section{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.card{background:var(--soft);border-radius:1rem;padding:1.25rem;border:1px solid #e0e7ff}
.card h3{margin:.4rem 0}
.muted{color:var(--muted)}
.price{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.price article{border:1px solid #e2e8f0;border-radius:1rem;padding:1.25rem}
.price .hot{border-color:var(--accent);box-shadow:0 10px 30px rgba(79,70,229,.15)}
@media(max-width:900px){.hero,.grid3,.price{grid-template-columns:1fr}}
"""

TAIL_APP = """export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">TailNext</strong><button className="btn" type="button">Download</button></header>
      <section className="hero">
        <div>
          <h1>Free template to start a website with Next.js + Tailwind CSS</h1>
          <p>Production-ready starter with best practices, SEO, accessibility, dark mode and great page speed.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Get template</button>
            <button type="button" style={{border:"1px solid #cbd5e1",background:"#fff",borderRadius:".7rem",padding:".7rem 1.1rem"}}>Learn more</button>
          </div>
          <div className="logos">
            <img src="/02-nextjs-logo.ae3da0a5.png" alt="Next.js" />
            <img src="/03-react-logo.5b4225d7.png" alt="React" />
            <img src="/04-tailwind-css-logo.9014e37f.png" alt="Tailwind" />
            <img src="/05-typescript-logo.37adc0f3.png" alt="TypeScript" />
          </div>
        </div>
        <img src="/01-hero.f20b02ee.jpg" alt="Hero" />
      </section>
      <section className="section">
        <h2>What you get with TailNext</h2>
        <p className="muted">Seamless integration, ready components and excellent performance.</p>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {["Next.js + Tailwind","Ready-to-use Components","Excellent Page Speed"].map((t) => (
            <article className="card" key={t}><h3>{t}</h3><p className="muted">Built for marketing sites, SaaS and blogs.</p></article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="grid3">
          <img src="/06-camera-front.bdbd1228.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
          <img src="/07-camera-back.0083b6e2.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
          <img src="/08-gas.f4f7ed48.jpg" alt="" style={{width:"100%",borderRadius:"1rem"}} />
        </div>
      </section>
      <section className="section">
        <h2>Prices for each plan</h2>
        <div className="price" style={{marginTop:"1rem"}}>
          <article><h3>basic</h3><strong style={{fontSize:"1.8rem"}}>$29</strong><p className="muted">per month</p></article>
          <article className="hot"><h3>standard</h3><strong style={{fontSize:"1.8rem"}}>$69</strong><p className="muted">per month</p></article>
          <article><h3>premium</h3><strong style={{fontSize:"1.8rem"}}>$199</strong><p className="muted">per month</p></article>
        </div>
      </section>
      <footer className="section" style={{paddingBottom:"3rem"}}>
        <h2>Get in Touch</h2>
        <p className="muted">tailnext@gmail.com · New York</p>
      </footer>
    </div>
  );
}
"""

TAIL_PREVIEW = """
<header class="top"><strong class="brand">TailNext</strong><button class="btn">Download</button></header>
<section class="hero"><div><h1>Next.js + Tailwind starter</h1><p>Production-ready website template.</p></div>
<img src="01-hero.f20b02ee.jpg" alt=""/></section>
"""


# ——— PODUX ———
PODUX_CSS = """
:root{--bg:#0b1020;--fg:#f8fafc;--muted:#94a3b8;--accent:#8b5cf6;--card:#121a2f;font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
.top{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem}
.brand{font-weight:800}
.btn{background:var(--accent);color:#fff;border:0;border-radius:.7rem;padding:.7rem 1.1rem;font-weight:700}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:2rem;max-width:1100px;margin:0 auto;padding:2.5rem 1.5rem;align-items:center}
.hero h1{font-size:clamp(2.2rem,5vw,3.4rem);letter-spacing:-.03em;margin:.5rem 0 1rem}
.hero p{color:var(--muted)}
.hero img{width:100%;border-radius:1.25rem;object-fit:cover;max-height:420px}
.section{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.card{display:grid;grid-template-columns:120px 1fr;gap:1rem;background:var(--card);border-radius:1rem;padding:1rem;border:1px solid #1e293b;align-items:center}
.card img{width:120px;height:90px;object-fit:cover;border-radius:.75rem}
.muted{color:var(--muted)}
.stats{display:flex;gap:2rem;margin-top:1.5rem}
@media(max-width:900px){.hero,.grid2,.card{grid-template-columns:1fr}}
"""

PODUX_APP = """export default function App() {
  const eps = [
    { img: "/02-podCast.webp", title: "How to ship secure websites", time: "23min" },
    { img: "/01-sidebiew.webp", title: "5 principles for clear code", time: "1h22" },
    { img: "/03-concentrated-young-african-american.webp", title: "Desktop development basics", time: "50min" },
    { img: "/02-podCast.webp", title: "Start your journey in SEO", time: "24min" },
  ];
  return (
    <div>
      <header className="top"><strong className="brand">Podux</strong><div style={{display:"flex",gap:".75rem"}}><button type="button" style={{background:"transparent",border:"1px solid #334155",color:"#fff",borderRadius:".7rem",padding:".65rem 1rem"}}>Sign in</button><button className="btn" type="button">Join Us</button></div></header>
      <section className="hero">
        <div>
          <p className="muted">New season available</p>
          <h1>Find and listen to your favorite podcast</h1>
          <p>Curated tech conversations for builders, designers and founders worldwide.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Join us</button>
            <button type="button" style={{background:"#1e293b",border:0,color:"#fff",borderRadius:".7rem",padding:".7rem 1.1rem"}}>Listening Episode</button>
          </div>
          <div className="stats"><div><strong>300+</strong><div className="muted">Listeners</div></div><div><strong>45+</strong><div className="muted">Episodes</div></div></div>
        </div>
        <img src="/03-concentrated-young-african-american.webp" alt="Studio" />
      </section>
      <section className="section">
        <h2>Latest Podcast</h2>
        <div className="grid2" style={{marginTop:"1rem"}}>
          {eps.map((e) => (
            <article className="card" key={e.title + e.time}>
              <img src={e.img} alt="" />
              <div>
                <div className="muted" style={{fontSize:".8rem"}}>{e.time}</div>
                <h3 style={{margin:".25rem 0"}}>{e.title}</h3>
                <button className="btn" type="button" style={{padding:".45rem .8rem",fontSize:".85rem"}}>Play now</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="section" style={{paddingBottom:"3rem"}}>
        <h2>Subscribe for new episodes</h2>
        <p className="muted">Fresh drops every week for the tech community.</p>
      </footer>
    </div>
  );
}
"""

PODUX_PREVIEW = """
<header class="top"><strong class="brand">Podux</strong><button class="btn">Join Us</button></header>
<section class="hero"><div><h1>Find and listen to your favorite podcast</h1><p>Tech conversations for builders.</p></div>
<img src="03-concentrated-young-african-american.webp" alt=""/></section>
"""


# ——— PLAY ———
PLAY_CSS = """
:root{--bg:#ffffff;--fg:#111827;--muted:#6b7280;--accent:#4a6cf7;--soft:#f3f4ff;font-family:"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}
.top{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e5e7eb}
.brand{font-weight:800;color:var(--accent)}
.btn{background:var(--accent);color:#fff;border:0;border-radius:.55rem;padding:.7rem 1.1rem;font-weight:700}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:2rem;max-width:1100px;margin:0 auto;padding:3rem 1.5rem;align-items:center}
.hero h1{font-size:clamp(2rem,5vw,3.1rem);letter-spacing:-.03em;margin:.5rem 0 1rem}
.hero p{color:var(--muted)}
.hero img{width:100%;border-radius:1rem}
.section{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.card{background:var(--soft);border-radius:1rem;padding:1.1rem;border:1px solid #e5e7eb}
.muted{color:var(--muted)}
.team img,.blog img{width:100%;border-radius:.85rem;height:140px;object-fit:cover}
.price{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.price article{border:1px solid #e5e7eb;border-radius:1rem;padding:1.25rem;text-align:center}
.price .hot{border-color:var(--accent);background:var(--soft)}
@media(max-width:900px){.hero,.grid4,.grid3,.price{grid-template-columns:1fr 1fr}.hero{grid-template-columns:1fr}}
"""

PLAY_APP = """export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">Play</strong><div style={{display:"flex",gap:".6rem"}}><button type="button" style={{background:"transparent",border:"1px solid #d1d5db",borderRadius:".55rem",padding:".6rem 1rem"}}>Sign In</button><button className="btn" type="button">Sign Up</button></div></header>
      <section className="hero">
        <div>
          <h1>Free template and starter for SaaS, Startup and App sites</h1>
          <p>Open-source Astro-inspired layout with essential pages, sections, components and a fully-functional blog feel.</p>
          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
            <button className="btn" type="button">Download Now</button>
            <button type="button" style={{background:"#111827",color:"#fff",border:0,borderRadius:".55rem",padding:".7rem 1.1rem"}}>Star on Github</button>
          </div>
        </div>
        <img src="/01-hero-image.jpg" alt="Hero" />
      </section>
      <section className="section">
        <h2>Main Features Of Play</h2>
        <div className="grid4" style={{marginTop:"1rem"}}>
          {["Free and Open-Source","Multipurpose Template","High-quality Design","All Essential Elements"].map((t) => (
            <article className="card" key={t}><h3>{t}</h3><p className="muted">Everything you need to launch faster.</p></article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="grid3">
          <img src="/02-about-image-01.jpg" alt="" />
          <img src="/03-about-image-02.jpg" alt="" />
          <div className="card"><h3>09+ Years of experience</h3><p className="muted">Toolkit to build next-gen websites faster.</p></div>
        </div>
      </section>
      <section className="section">
        <h2>Awesome Pricing Plan</h2>
        <div className="price" style={{marginTop:"1rem"}}>
          <article><h3>Starter</h3><strong style={{fontSize:"1.8rem"}}>$25</strong><p className="muted">Per Month</p></article>
          <article className="hot"><h3>Basic</h3><strong style={{fontSize:"1.8rem"}}>$59</strong><p className="muted">Per Month</p></article>
          <article><h3>Premium</h3><strong style={{fontSize:"1.8rem"}}>$99</strong><p className="muted">Per Month</p></article>
        </div>
      </section>
      <section className="section">
        <h2>Our Creative Team</h2>
        <div className="grid4 team" style={{marginTop:"1rem"}}>
          {[
            ["/07-team-01.png","Matheus Ferrero"],
            ["/08-team-02.png","Stuard Ferrel"],
            ["/09-team-03.png","Eva Hudson"],
            ["/10-team-04.png","Jackie Sanders"],
          ].map(([img, name]) => (
            <article key={name}><img src={img} alt={name} /><h3 style={{fontSize:"1rem"}}>{name}</h3></article>
          ))}
        </div>
      </section>
      <section className="section blog" style={{paddingBottom:"3rem"}}>
        <h2>Our Recent News</h2>
        <div className="grid3" style={{marginTop:"1rem"}}>
          {[
            ["/11-blog-01.jpg","Upselling guide"],
            ["/12-blog-02.jpg","Wellness coaching"],
            ["/13-blog-03.jpg","AutoManage tools"],
          ].map(([img, title]) => (
            <article key={title}><img src={img} alt={title} /><h3 style={{fontSize:"1rem"}}>{title}</h3></article>
          ))}
        </div>
      </section>
    </div>
  );
}
"""

PLAY_PREVIEW = """
<header class="top"><strong class="brand">Play</strong><button class="btn">Sign Up</button></header>
<section class="hero"><div><h1>SaaS & Startup starter</h1><p>Essential pages and components.</p></div>
<img src="01-hero-image.jpg" alt=""/></section>
"""


TEMPLATES_DEF = [
    {
        "id": "sarab-restaurant",
        "media": "sarab",
        "title": {"en": "Sarab Restaurant", "fr": "Sarab Restaurant"},
        "description": {
            "en": "Fast-food restaurant demo: hero, menu grid, offers and reservation vibe.",
            "fr": "Démo resto fast-food : hero, grille menu, offres et réservation.",
        },
        "tags": ["restaurant", "food", "menu"],
        "bootHint": {
            "en": "Adapt Sarab: rename restaurant, dishes, prices and contact details.",
            "fr": "Adapte Sarab : nom du resto, plats, prix et coordonnées.",
        },
        "accent": "#e11d2e",
        "bg": "#fff8f3",
        "fg": "#1a1a1a",
        "muted": "#6b7280",
        "tone": "Warm hospitality, appetizing, conversion-oriented.",
        "app": SARAB_APP,
        "css": SARAB_CSS,
        "preview_body": SARAB_PREVIEW,
    },
    {
        "id": "bloom-shop",
        "media": "bloomtpl",
        "title": {"en": "Bloom Shop", "fr": "Bloom Shop"},
        "description": {
            "en": "Sneaker storefront with product grid and newsletter.",
            "fr": "Boutique sneakers avec grille produits et newsletter.",
        },
        "tags": ["ecommerce", "fashion", "shop"],
        "bootHint": {
            "en": "Adapt Bloom: products, prices and brand voice.",
            "fr": "Adapte Bloom : produits, prix et ton de marque.",
        },
        "accent": "#111111",
        "bg": "#f7f7f5",
        "fg": "#111111",
        "muted": "#6b7280",
        "tone": "Clean retail, modern catalog.",
        "app": BLOOM_APP,
        "css": BLOOM_CSS,
        "preview_body": BLOOM_PREVIEW,
    },
    {
        "id": "folio-eliott",
        "media": "folio-tailwind",
        "title": {"en": "Eliott Portfolio", "fr": "Portfolio Eliott"},
        "description": {
            "en": "Dark freelance portfolio with work grid and about.",
            "fr": "Portfolio freelance sombre avec travaux et à propos.",
        },
        "tags": ["portfolio", "freelance", "dark"],
        "bootHint": {
            "en": "Adapt Eliott: name, services, case studies and contact.",
            "fr": "Adapte Eliott : nom, services, études de cas et contact.",
        },
        "accent": "#a3e635",
        "bg": "#0b0b0c",
        "fg": "#f5f5f5",
        "muted": "#a1a1aa",
        "tone": "Confident, minimal, creative.",
        "app": FOLIO_APP,
        "css": FOLIO_CSS,
        "preview_body": FOLIO_PREVIEW,
    },
    {
        "id": "tailnext-saas",
        "media": "tailnext",
        "title": {"en": "TailNext SaaS", "fr": "TailNext SaaS"},
        "description": {
            "en": "Next/Tailwind marketing site with features and pricing.",
            "fr": "Site marketing Next/Tailwind avec features et pricing.",
        },
        "tags": ["saas", "marketing", "landing"],
        "bootHint": {
            "en": "Adapt TailNext: product name, feature cards and plans.",
            "fr": "Adapte TailNext : nom produit, features et plans.",
        },
        "accent": "#4f46e5",
        "bg": "#ffffff",
        "fg": "#0f172a",
        "muted": "#64748b",
        "tone": "Product marketing, clear hierarchy.",
        "app": TAIL_APP,
        "css": TAIL_CSS,
        "preview_body": TAIL_PREVIEW,
    },
    {
        "id": "podux-podcast",
        "media": "podux",
        "title": {"en": "Podux Podcast", "fr": "Podux Podcast"},
        "description": {
            "en": "Podcast platform landing with episodes and listen CTAs.",
            "fr": "Landing podcast avec épisodes et CTA d’écoute.",
        },
        "tags": ["podcast", "media", "audio"],
        "bootHint": {
            "en": "Adapt Podux: show name, episode titles and subscribe CTA.",
            "fr": "Adapte Podux : nom du show, titres d’épisodes et CTA.",
        },
        "accent": "#8b5cf6",
        "bg": "#0b1020",
        "fg": "#f8fafc",
        "muted": "#94a3b8",
        "tone": "Tech community, energetic.",
        "app": PODUX_APP,
        "css": PODUX_CSS,
        "preview_body": PODUX_PREVIEW,
    },
    {
        "id": "play-startup",
        "media": "play-astro",
        "title": {"en": "Play Startup", "fr": "Play Startup"},
        "description": {
            "en": "SaaS/startup multipage feel: features, pricing, team, blog.",
            "fr": "Style SaaS/startup : features, pricing, équipe, blog.",
        },
        "tags": ["startup", "saas", "astro"],
        "bootHint": {
            "en": "Adapt Play: product story, pricing tiers, team and posts.",
            "fr": "Adapte Play : histoire produit, tarifs, équipe et articles.",
        },
        "accent": "#4a6cf7",
        "bg": "#ffffff",
        "fg": "#111827",
        "muted": "#6b7280",
        "tone": "Startup marketing, trustworthy.",
        "app": PLAY_APP,
        "css": PLAY_CSS,
        "preview_body": PLAY_PREVIEW,
    },
]


def main() -> None:
    TEMPLATES.mkdir(parents=True, exist_ok=True)
    for name in OLD:
        path = TEMPLATES / name
        if path.is_dir():
            shutil.rmtree(path)
            print("removed", name)

    for meta in TEMPLATES_DEF:
        dest = TEMPLATES / meta["id"]
        if dest.exists():
            shutil.rmtree(dest)
        write_base(dest, meta["id"], meta["title"]["en"])
        copied = copy_media(meta["media"], dest / "public")
        (dest / "src" / "App.tsx").write_text(meta["app"], encoding="utf-8")
        (dest / "src" / "index.css").write_text(meta["css"], encoding="utf-8")
        write_meta(
            dest,
            {
                "id": meta["id"],
                "title": meta["title"],
                "description": meta["description"],
                "tags": meta["tags"],
                "preview": "preview.html",
                "bootHint": meta["bootHint"],
                "accent": meta["accent"],
                "bg": meta["bg"],
                "fg": meta["fg"],
                "muted": meta["muted"],
                "tone": meta["tone"],
            },
        )
        # preview uses relative public images — copy is already in public/, so rewrite body paths as-is
        write_preview(dest, meta["title"]["en"], meta["css"], meta["preview_body"])
        # Keep bare filenames in preview.html; SiteThumb rewrites to /templates/{id}/media/.
        print(f"built {meta['id']} ({len(copied)} images)")

    print(f"OK {len(TEMPLATES_DEF)} templates")


if __name__ == "__main__":
    main()
