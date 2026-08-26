const features = [
  { icon: "⚡", title: "Instant changelogs", text: "Turn merged pull requests into polished release notes your customers actually read." },
  { icon: "🧭", title: "Guided rollouts", text: "Ship to 1%, watch the metrics, then widen the audience with a single click." },
  { icon: "🔔", title: "Smart notifications", text: "Announce updates in-app, by email or on Slack without writing the same post three times." },
  { icon: "📊", title: "Adoption analytics", text: "See which features get used within hours of release, not weeks later in a spreadsheet." },
  { icon: "🛡️", title: "Approval workflows", text: "Legal and marketing review drafts in one place before anything goes public." },
  { icon: "🧩", title: "Open API", text: "Pipe release data anywhere with webhooks and a friendly, well-documented REST API." },
];

const plans = [
  {
    name: "Starter", price: "$19", period: "per month", featured: false,
    perks: ["1 product space", "Unlimited posts", "Email announcements", "Community support"],
    cta: "Start free trial",
  },
  {
    name: "Growth", price: "$49", period: "per month", featured: true,
    perks: ["5 product spaces", "Rollout targeting", "Slack + in-app widgets", "Adoption analytics", "Priority support"],
    cta: "Choose Growth",
  },
  {
    name: "Scale", price: "$129", period: "per month", featured: false,
    perks: ["Unlimited spaces", "Approval workflows", "SSO and audit log", "Dedicated manager"],
    cta: "Talk to sales",
  },
];

const partners = ["Northbeam", "Kitefox", "Lumora", "Draftly", "Quanta", "Heliodor"];

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">Pulsedeck</span>
        <nav className="nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="btn btn-primary" href="#pricing">Get started</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Release communication, solved</p>
          <h1>Ship product updates your users actually notice</h1>
          <p className="lead">
            Pulsedeck turns every release into a clear announcement, a targeted rollout and a
            measurable adoption curve — all from one calm dashboard.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#pricing">Start free trial</a>
            <a className="btn btn-ghost" href="#features">See how it works</a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="mock-card">
            <div className="mock-row wide"></div>
            <div className="mock-row"></div>
            <div className="mock-row short"></div>
            <div className="mock-chart">
              <span style={{ height: "30%" }}></span>
              <span style={{ height: "55%" }}></span>
              <span style={{ height: "42%" }}></span>
              <span style={{ height: "78%" }}></span>
              <span style={{ height: "64%" }}></span>
              <span style={{ height: "92%" }}></span>
            </div>
          </div>
        </div>
      </section>

      <section className="logos" aria-label="Trusted by">
        {partners.map((p) => (
          <span key={p} className="logo-pill">{p}</span>
        ))}
      </section>

      <section id="features" className="features">
        <h2>Everything a release needs</h2>
        <p className="section-lead">From draft to adoption report, without leaving Pulsedeck.</p>
        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="pricing">
        <h2>Simple pricing</h2>
        <p className="section-lead">Every plan starts with a 14-day free trial. No card required.</p>
        <div className="plan-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={plan.featured ? "plan plan-featured" : "plan"}>
              {plan.featured && <span className="plan-badge">Most popular</span>}
              <h3>{plan.name}</h3>
              <p className="plan-price">
                {plan.price} <small>{plan.period}</small>
              </p>
              <ul>
                {plan.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <a className={plan.featured ? "btn btn-primary" : "btn btn-ghost"} href="#contact">
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>

      <footer id="contact" className="footer">
        <div className="footer-grid">
          <div>
            <span className="brand brand-light">Pulsedeck</span>
            <p>Release communication for calm product teams. Built with care, priced fairly.</p>
          </div>
          <div>
            <h4>Contact</h4>
            <p>hello@pulsedeck.example</p>
            <p>+1 (555) 010-2030</p>
          </div>
          <div>
            <h4>Office</h4>
            <p>42 Harbor Lane</p>
            <p>Portland, OR</p>
          </div>
        </div>
        <p className="footer-note">© 2026 Pulsedeck Labs. A fictional product for demo purposes.</p>
      </footer>
    </div>
  );
}
