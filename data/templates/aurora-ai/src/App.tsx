import { useState } from "react";

const NAV_LINKS = ["Product", "Features", "Pricing", "Customers", "Docs"];

const FEATURES = [
  {
    icon: "🧠",
    title: "Autonomous agents",
    text: "Deploy agents that triage tickets, draft replies and reconcile data across 40+ tools — with human approval gates wherever you want them.",
  },
  {
    icon: "⚡",
    title: "Sub-second inference",
    text: "Our routing layer picks the fastest capable model per request. Median latency 380ms, p99 under 1.2s, globally.",
  },
  {
    icon: "🔐",
    title: "Private by design",
    text: "SOC 2 Type II, zero data retention mode, and optional VPC deployment. Your prompts never train anyone's model.",
  },
  {
    icon: "🧩",
    title: "Composable workflows",
    text: "Chain models, tools and conditions in a visual builder or plain TypeScript. Version, test and roll back like real software.",
  },
  {
    icon: "📊",
    title: "Evaluation built in",
    text: "Score every output against golden datasets. Catch regressions before your users do, with automatic weekly eval runs.",
  },
  {
    icon: "🌍",
    title: "Multilingual out of the box",
    text: "94 languages with consistent tone. One workflow serves Tokyo, Berlin and São Paulo without a single branch.",
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    blurb: "For side projects and evaluation.",
    features: ["10k model calls / month", "2 workflows", "Community support", "Shared infrastructure"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Scale",
    price: "$249",
    period: "/mo",
    blurb: "For teams shipping AI to production.",
    features: ["1M model calls / month", "Unlimited workflows", "Eval suite + regression alerts", "Priority routing (p99 < 1.2s)", "Slack support, 4h SLA"],
    cta: "Start 14-day trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For regulated and high-volume workloads.",
    features: ["Unlimited volume", "VPC / on-prem deployment", "Zero data retention", "Dedicated solutions engineer", "99.99% uptime SLA"],
    cta: "Talk to sales",
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We replaced three internal tools with a single Aurora workflow. Support resolution time dropped from 9 hours to 41 minutes.",
    name: "Maya Lindqvist",
    role: "VP Operations, Fernbrook",
  },
  {
    quote:
      "The eval suite is the killer feature. We ship prompt changes daily now because regressions get caught automatically.",
    name: "Daniel Okafor",
    role: "Head of AI, Klarwave",
  },
  {
    quote:
      "Aurora's VPC deployment cleared our security review in two weeks. Every other vendor took months or failed outright.",
    name: "Sophie Marchetti",
    role: "CISO, Nordbank Digital",
  },
];

const STATS = [
  { value: "2.4B", label: "model calls / month" },
  { value: "380ms", label: "median latency" },
  { value: "1,900+", label: "teams in production" },
  { value: "99.99%", label: "uptime last 12 months" },
];

const LOGOS = ["Fernbrook", "Klarwave", "Nordbank", "Hexalab", "Vantoro", "Prismatic"];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="page">
      <div className="aurora aurora-a" aria-hidden="true" />
      <div className="aurora aurora-b" aria-hidden="true" />
      <div className="aurora aurora-c" aria-hidden="true" />

      <header className="nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <span className="brand-orb" />
            Aurora<span className="brand-thin">AI</span>
          </a>
          <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
            {NAV_LINKS.map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setMenuOpen(false)}>
                {link}
              </a>
            ))}
          </nav>
          <div className="nav-actions">
            <a className="btn btn-ghost" href="#pricing">Sign in</a>
            <a className="btn btn-primary" href="#pricing">Get started</a>
            <button className="nav-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              ☰
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <span className="pill">✦ Series B — $48M raised</span>
            <h1>
              Intelligence that works
              <br />
              <span className="grad-text">while you sleep.</span>
            </h1>
            <p className="lede">
              Aurora turns frontier models into reliable coworkers. Build, evaluate and deploy AI
              workflows that handle real operations — support, finance, compliance — in production, at scale.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#pricing">Start building free</a>
              <a className="btn btn-glass btn-lg" href="#features">Watch the demo ▸</a>
            </div>
            <p className="hero-note">No credit card required · 10k free calls every month</p>
          </div>

          <div className="hero-stage">
            <div className="mockup-tilt">
              <div className="mockup-frame glass">
                <div className="mockup-bar">
                  <span className="dot dot-r" />
                  <span className="dot dot-y" />
                  <span className="dot dot-g" />
                  <span className="mockup-url">app.aurora.ai/workflows</span>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70"
                  alt="Aurora AI dashboard"
                  className="mockup-img"
                />
              </div>
              <div className="float-card glass float-a">
                <span className="float-icon">⚡</span>
                <div>
                  <strong>Workflow deployed</strong>
                  <small>invoice-triage · v42 · 380ms</small>
                </div>
              </div>
              <div className="float-card glass float-b">
                <span className="float-icon">✅</span>
                <div>
                  <strong>Evals passing</strong>
                  <small>128/128 golden cases</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="logos container" id="customers">
          <p className="logos-label">Trusted by teams shipping AI in production</p>
          <div className="logos-row">
            {LOGOS.map((l) => (
              <span key={l} className="logo-item">{l}</span>
            ))}
          </div>
        </section>

        <section className="stats container">
          {STATS.map((s) => (
            <div key={s.label} className="stat glass">
              <span className="stat-value grad-text">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        <section className="features container" id="features">
          <div className="section-head">
            <span className="pill">Product</span>
            <h2>Everything between the model and production.</h2>
            <p>
              The gap between a great demo and a reliable product is enormous. Aurora is the
              infrastructure that closes it.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature-card glass">
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="showcase container" id="product">
          <div className="showcase-media glass">
            <img
              src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=70"
              alt="AI at work"
            />
          </div>
          <div className="showcase-copy">
            <span className="pill">Why Aurora</span>
            <h2>From prototype to production in a week, not a quarter.</h2>
            <ul className="check-list">
              <li>
                <strong>Model-agnostic routing.</strong> Swap between GPT, Claude, Gemini and open
                models without touching a line of workflow code.
              </li>
              <li>
                <strong>Deterministic replays.</strong> Every run is recorded. Reproduce any output,
                any time, for audits or debugging.
              </li>
              <li>
                <strong>Cost guardrails.</strong> Per-workflow budgets with automatic downgrade
                paths. Our customers cut inference spend by 37% on average.
              </li>
            </ul>
            <a className="btn btn-primary" href="#pricing">Explore the platform</a>
          </div>
        </section>

        <section className="pricing container" id="pricing">
          <div className="section-head">
            <span className="pill">Pricing</span>
            <h2>Simple pricing. Serious infrastructure.</h2>
            <div className="billing-toggle glass">
              <button
                className={billing === "monthly" ? "active" : ""}
                onClick={() => setBilling("monthly")}
              >
                Monthly
              </button>
              <button
                className={billing === "yearly" ? "active" : ""}
                onClick={() => setBilling("yearly")}
              >
                Yearly <em>−20%</em>
              </button>
            </div>
          </div>
          <div className="tier-grid">
            {TIERS.map((t) => (
              <article key={t.name} className={`tier glass ${t.featured ? "tier-featured" : ""}`}>
                {t.featured && <span className="tier-badge">Most popular</span>}
                <h3>{t.name}</h3>
                <p className="tier-blurb">{t.blurb}</p>
                <div className="tier-price">
                  <span className="tier-amount">
                    {t.name === "Scale" && billing === "yearly" ? "$199" : t.price}
                  </span>
                  <span className="tier-period">{t.period}</span>
                </div>
                <ul>
                  {t.features.map((f) => (
                    <li key={f}>
                      <span className="check">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a className={`btn ${t.featured ? "btn-primary" : "btn-glass"} btn-block`} href="#top">
                  {t.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="testimonials container">
          <div className="section-head">
            <span className="pill">Customers</span>
            <h2>Loved by operators, trusted by security teams.</h2>
          </div>
          <div className="quote-grid">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="quote glass">
                <span className="quote-mark">“</span>
                <blockquote>{t.quote}</blockquote>
                <figcaption>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="cta container">
          <div className="cta-panel glass">
            <div className="cta-glow" aria-hidden="true" />
            <h2>Ship your first AI workflow today.</h2>
            <p>Join 1,900+ teams running real operations on Aurora. Free tier forever.</p>
            <div className="hero-cta cta-center">
              <a className="btn btn-primary btn-lg" href="#top">Get started free</a>
              <a className="btn btn-glass btn-lg" href="#top">Book a demo</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#top">
              <span className="brand-orb" />
              Aurora<span className="brand-thin">AI</span>
            </a>
            <p>Intelligence that works while you sleep. Built in Stockholm & San Francisco.</p>
          </div>
          <div className="footer-cols">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#top">Changelog</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#top">About</a>
              <a href="#top">Careers</a>
              <a href="#top">Blog</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="#top">Docs</a>
              <a href="#top">API status</a>
              <a href="#top">Security</a>
            </div>
          </div>
        </div>
        <div className="container footer-base">
          <span>© 2026 Aurora Labs AB. All rights reserved.</span>
          <span>Privacy · Terms · DPA</span>
        </div>
      </footer>
    </div>
  );
}
