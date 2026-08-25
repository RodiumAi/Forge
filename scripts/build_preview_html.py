#!/usr/bin/env python3
"""Build self-contained preview.html for each Forge template (card thumbnails)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "templates"

BODIES: dict[str, str] = {
    "landing-saas": """
<div class="page">
  <header class="nav"><strong class="logo">Nova<span>Ops</span></strong>
    <nav><a href="#">Features</a><a href="#">Pricing</a><a class="btn" href="#">Start free</a></nav>
  </header>
  <section class="hero">
    <p class="eyebrow">Ship faster</p>
    <h1>Automate ops without the spreadsheet chaos</h1>
    <p class="lede">One workspace for alerts, runbooks and team handoffs.</p>
    <div class="actions"><a class="btn" href="#">Get started</a><a class="ghost" href="#">See how it works</a></div>
  </section>
  <section class="grid">
    <article><h3>Live alerts</h3><p>Replace scattered chats with a single source of truth.</p></article>
    <article><h3>Shared runbooks</h3><p>Replace scattered chats with a single source of truth.</p></article>
    <article><h3>Audit trail</h3><p>Replace scattered chats with a single source of truth.</p></article>
  </section>
</div>
""",
    "portfolio-creative": """
<div class="page">
  <header class="hero"><p class="eyebrow">Designer / Art direction</p><h1>Maya Chen</h1>
    <p class="lede">Visual systems for brands that want to feel alive.</p></header>
  <section class="grid">
    <article><div class="thumb"></div><h3>Aurora Brand</h3><p>Brand identity · 2025</p></article>
    <article><div class="thumb"></div><h3>Kinetic Type</h3><p>Brand identity · 2025</p></article>
    <article><div class="thumb"></div><h3>Studio Atlas</h3><p>Brand identity · 2025</p></article>
    <article><div class="thumb"></div><h3>Night Market</h3><p>Brand identity · 2025</p></article>
  </section>
</div>
""",
    "docs-minimal": """
<div class="shell">
  <aside><strong>Forge Docs</strong><nav>
    <a href="#">Introduction</a><a href="#">Quickstart</a><a href="#">API</a><a href="#">Guides</a>
  </nav></aside>
  <main>
    <h1>Introduction</h1>
    <p class="lede">Learn how to integrate Forge into your product in minutes.</p>
    <h2>What you get</h2>
    <ul><li>Hosted previews</li><li>Chat-driven edits</li><li>Connectors</li></ul>
  </main>
</div>
""",
    "dashboard-admin": """
<div class="shell">
  <aside><strong>Pulse</strong><a href="#">Overview</a><a href="#">Customers</a><a href="#">Billing</a></aside>
  <main>
    <h1>Overview</h1>
    <div class="kpis">
      <article><span>MRR</span><strong>$48.2k</strong></article>
      <article><span>Active</span><strong>1,284</strong></article>
      <article><span>Churn</span><strong>2.1%</strong></article>
    </div>
    <table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Acme</td><td>Pro</td><td>Active</td></tr>
      <tr><td>Northwind</td><td>Starter</td><td>Trial</td></tr>
    </tbody></table>
  </main>
</div>
""",
    "blog-magazine": """
<div class="page">
  <header class="top"><strong>Field Notes</strong><nav><a href="#">Latest</a><a href="#">Topics</a></nav></header>
  <section class="featured"><p class="cat">Cover</p>
    <h1>Building calm software in a noisy market</h1>
    <p>A practical guide to focus, craft and durable product loops.</p>
  </section>
  <section class="list">
    <article><span>Product</span><h3>Why shipping weekly beats big launches</h3></article>
    <article><span>Design</span><h3>Charters that keep AI on-brand</h3></article>
  </section>
</div>
""",
    "ecommerce-product": """
<div class="page">
  <header class="bar"><strong>Atelier</strong><button type="button">Cart (1)</button></header>
  <section class="product">
    <div class="gallery"></div>
    <div class="info">
      <p class="eyebrow">New arrival</p>
      <h1>Ceramic pour-over set</h1>
      <p class="price">$86</p>
      <p class="desc">Matte stoneware dripper with matching carafe.</p>
      <div class="variants"><button type="button" class="active">Sand</button><button type="button">Ink</button></div>
      <button type="button" class="buy">Add to cart</button>
    </div>
  </section>
</div>
""",
    "agency-services": """
<div class="page">
  <section class="hero"><p class="eyebrow">Product studio</p>
    <h1>We design and ship revenue-critical interfaces</h1>
    <p class="lede">Strategy, UX and front-end for teams who need craft at speed.</p>
  </section>
  <section class="services">
    <article><h3>Discovery</h3><p>Focused engagements with clear outcomes.</p></article>
    <article><h3>Design systems</h3><p>Focused engagements with clear outcomes.</p></article>
    <article><h3>Build &amp; launch</h3><p>Focused engagements with clear outcomes.</p></article>
  </section>
</div>
""",
    "waitlist-launch": """
<div class="page center">
  <p class="eyebrow">Launching soon</p>
  <h1>Orbit</h1>
  <p class="lede">The calendar that plans your week for you.</p>
  <form class="form"><input type="email" placeholder="you@company.com" /><button type="submit">Join waitlist</button></form>
  <p class="meta">2,418 builders already in line</p>
</div>
""",
    "restaurant-menu": """
<div class="page">
  <header class="hero"><p class="eyebrow">Downtown · Dinner</p><h1>Maison Rue</h1>
    <p class="lede">Seasonal plates, open kitchen, quiet evenings.</p>
    <a class="btn" href="#">Reserve a table</a>
  </header>
  <section class="menu"><h2>Tonight</h2>
    <article><div><h3>Tomato toast</h3><p>ricotta, basil oil</p></div><strong>9</strong></article>
    <article><div><h3>Catch of the day</h3><p>citrus butter</p></div><strong>24</strong></article>
  </section>
</div>
""",
    "event-conference": """
<div class="page">
  <header class="hero"><p class="eyebrow">May 12 · Paris</p><h1>Builders Summit</h1>
    <p class="lede">One day of product craft, AI workflows and shipping stories.</p>
    <a class="btn" href="#">Get tickets</a>
  </header>
  <section class="agenda"><h2>Agenda</h2>
    <article><time>09:30</time><div><h3>Opening keynote</h3><p>Amina Rao</p></div></article>
    <article><time>11:00</time><div><h3>AI that ships</h3><p>Leo Park</p></div></article>
  </section>
</div>
""",
}


def wrap(title: str, css: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
{css}
html, body {{ overflow: hidden; }}
a, button {{ pointer-events: none; }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""


def main() -> None:
    for folder in sorted(ROOT.iterdir()):
        if not folder.is_dir():
            continue
        tid = folder.name
        css_path = folder / "src" / "index.css"
        if not css_path.is_file():
            print("skip", tid)
            continue
        body = BODIES.get(tid)
        if not body:
            print("no body", tid)
            continue
        css = css_path.read_text(encoding="utf-8")
        html = wrap(tid, css, body)
        (folder / "preview.html").write_text(html, encoding="utf-8")
        print("preview", tid)
    print("done")


if __name__ == "__main__":
    main()
