import { useState } from "react";

const isoCards = [
  {
    icon: "◧",
    title: "Live parametric surfaces",
    text: "Drag a slider, watch the whole assembly re-solve in under 16ms. Constraints propagate across every folded panel.",
  },
  {
    icon: "⬡",
    title: "Version-controlled geometry",
    text: "Every fold, extrude and boolean lands in a diff you can read. Branch a prototype like you branch code.",
  },
  {
    icon: "◇",
    title: "One-click fabrication export",
    text: "Flatten to DXF for laser cutting, export STEP for CNC, or ship straight to our print network in 40 cities.",
  },
];

const foldPanels = [
  {
    num: "01",
    title: "Sketch flat",
    text: "Start in 2D like you always have. Foldspace tracks every crease line as a live hinge with real material thickness.",
  },
  {
    num: "02",
    title: "Fold in space",
    text: "Pull any edge and the sheet folds along its hinges. Collision detection stops impossible geometry before you commit.",
  },
  {
    num: "03",
    title: "Ship the part",
    text: "Simulate load, unfold to a cut pattern, and send to fabrication — all without leaving the browser tab.",
  },
];

const stats = [
  { value: "16ms", label: "constraint solve, p95" },
  { value: "48k", label: "engineers on the platform" },
  { value: "2.3M", label: "parts fabricated in 2025" },
  { value: "40", label: "cities in the print network" },
];

const plans = [
  {
    name: "Maker",
    price: "$0",
    period: "forever",
    features: ["3 active projects", "Community fab network", "DXF export", "Public gallery"],
    featured: false,
  },
  {
    name: "Studio",
    price: "$32",
    period: "per seat / month",
    features: ["Unlimited projects", "Geometry version control", "STEP + 3MF export", "Priority fabrication", "SSO"],
    featured: true,
  },
  {
    name: "Factory",
    price: "Custom",
    period: "annual",
    features: ["On-prem solver cluster", "PLM integrations", "Dedicated success engineer", "SLA 99.95%"],
    featured: false,
  },
];

const faqs = [
  {
    q: "Does Foldspace run fully in the browser?",
    a: "Yes. The constraint solver is compiled to WebAssembly and runs locally. Nothing leaves your machine until you hit share.",
  },
  {
    q: "Can I import existing CAD files?",
    a: "STEP, IGES, DXF and SVG all import with hinge detection. Most sheet-metal parts round-trip losslessly.",
  },
  {
    q: "What materials does the fab network support?",
    a: "Aluminium 5052, mild steel, birch ply, acrylic, PETG and polypropylene, in thicknesses from 0.5 to 6 mm.",
  },
  {
    q: "Is there an API?",
    a: "A full REST + WebSocket API ships with the Studio plan. Generate geometry from code, trigger exports, or embed the viewer.",
  },
];

export default function App() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="page">
      {/* ---------- Navbar ---------- */}
      <header className="nav">
        <a className="nav-logo" href="#top">
          <span className="nav-mark" aria-hidden="true" />
          Foldspace
        </a>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-ghost" href="#pricing">Sign in</a>
          <a className="btn btn-solid" href="#pricing">Start folding</a>
        </div>
      </header>

      {/* ---------- Hero with CSS cube ---------- */}
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-badge">✦ Foldspace 2.0 — now with live load simulation</p>
          <h1 className="hero-title">
            Prototype in
            <br />
            <span className="hero-accent">three dimensions,</span>
            <br />
            think in one sheet.
          </h1>
          <p className="hero-sub">
            Foldspace is the browser-native prototyping platform where flat
            sketches become folded, fabricable parts. Design, simulate and
            ship hardware at software speed.
          </p>
          <div className="hero-cta">
            <a className="btn btn-solid btn-lg" href="#pricing">Start free — no card</a>
            <a className="btn btn-ghost btn-lg" href="#how">Watch it fold ↓</a>
          </div>
          <p className="hero-note">Trusted by teams at Framework, Prusa Labs and Ortho Robotics.</p>
        </div>
        <div className="hero-stage">
          <div className="cube-scene">
            <div className="cube">
              <div className="cube-face face-front">FOLD</div>
              <div className="cube-face face-back">SHIP</div>
              <div className="cube-face face-right">CUT</div>
              <div className="cube-face face-left">BEND</div>
              <div className="cube-face face-top">✦</div>
              <div className="cube-face face-bottom">3D</div>
            </div>
            <div className="cube-shadow" />
          </div>
        </div>
      </section>

      {/* ---------- Folded hinge panels ---------- */}
      <section className="section" id="how">
        <div className="section-head">
          <h2 className="section-title">From flat sheet to finished part</h2>
          <p className="section-sub">Hover a panel — it unfolds. That is also, roughly, the product.</p>
        </div>
        <div className="fold-row">
          {foldPanels.map((p) => (
            <div className="fold-scene" key={p.num}>
              <div className="fold-panel">
                <div className="fold-face">
                  <span className="fold-num">{p.num}</span>
                  <h3 className="fold-title">{p.title}</h3>
                  <p className="fold-text">{p.text}</p>
                </div>
                <div className="fold-flap" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Isometric feature cards ---------- */}
      <section className="section section-alt" id="features">
        <div className="section-head">
          <h2 className="section-title">Engineered for the way parts actually get made</h2>
          <p className="section-sub">Every feature exists because a prototype failed without it.</p>
        </div>
        <div className="iso-grid">
          {isoCards.map((c) => (
            <div className="iso-wrap" key={c.title}>
              <div className="iso-card">
                <span className="iso-icon">{c.icon}</span>
              </div>
              <h3 className="iso-title">{c.title}</h3>
              <p className="iso-text">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Depth planes / workflow ---------- */}
      <section className="section">
        <div className="planes">
          <div className="plane plane-back" aria-hidden="true" />
          <div className="plane plane-mid" aria-hidden="true" />
          <div className="plane plane-front">
            <div className="plane-copy">
              <p className="eyebrow">Inside a real team</p>
              <h2 className="plane-title">Ortho Robotics cut prototype cycles from 3 weeks to 4 days</h2>
              <p className="plane-text">
                Their gripper chassis went through 31 folded revisions in one
                sprint. Every revision was a branch; every fabrication run, a
                tagged release. QA reviewed geometry diffs like pull requests.
              </p>
              <a className="btn btn-solid" href="#pricing">Read the case study</a>
            </div>
            <img
              className="plane-img"
              src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=70"
              alt="Engineer working at a prototyping workstation"
            />
          </div>
        </div>
        <div className="stats-row">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section className="section section-alt" id="pricing">
        <div className="section-head">
          <h2 className="section-title">Pricing that unfolds with you</h2>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button
              className={billing === "monthly" ? "on" : ""}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              className={billing === "yearly" ? "on" : ""}
              onClick={() => setBilling("yearly")}
            >
              Yearly −20%
            </button>
          </div>
        </div>
        <div className="plans">
          {plans.map((p) => (
            <div className={"plan" + (p.featured ? " featured" : "")} key={p.name}>
              {p.featured && <span className="plan-flag">Most popular</span>}
              <h3 className="plan-name">{p.name}</h3>
              <p className="plan-price">
                {p.name === "Studio" && billing === "yearly" ? "$25" : p.price}
                <span> {p.period}</span>
              </p>
              <ul className="plan-list">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <a className={"btn btn-lg " + (p.featured ? "btn-solid" : "btn-ghost")} href="#top">
                {p.price === "Custom" ? "Talk to sales" : "Get started"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="section" id="faq">
        <div className="section-head">
          <h2 className="section-title">Questions, unfolded</h2>
        </div>
        <div className="faq">
          {faqs.map((f, i) => (
            <div className={"faq-item" + (openFaq === i ? " open" : "")} key={f.q}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {f.q}
                <span className="faq-toggle">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className="faq-a">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="cta-band">
        <h2 className="cta-title">Your next part is one fold away.</h2>
        <p className="cta-sub">Free forever for makers. Five minutes to your first folded prototype.</p>
        <a className="btn btn-invert btn-lg" href="#top">Start folding — it's free</a>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="footer-cols">
          <div>
            <p className="footer-logo">
              <span className="nav-mark" aria-hidden="true" /> Foldspace
            </p>
            <p className="footer-small">Hardware at software speed.<br />© 2026 Foldspace Inc.</p>
          </div>
          <div>
            <p className="footer-head">Product</p>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#top">Changelog</a>
          </div>
          <div>
            <p className="footer-head">Resources</p>
            <a href="#top">Docs</a>
            <a href="#top">API reference</a>
            <a href="#top">Fab network</a>
          </div>
          <div>
            <p className="footer-head">Company</p>
            <a href="#top">About</a>
            <a href="#top">Careers</a>
            <a href="#top">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
