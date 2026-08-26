const services = [
  { icon: "◈", title: "Product Discovery", text: "Workshops and user research that turn vague ideas into a roadmap the whole team believes in." },
  { icon: "▣", title: "Interface Design", text: "Design systems and high-fidelity prototypes engineered to move users toward action." },
  { icon: "⌘", title: "App Engineering", text: "Robust web applications on modern stacks, shipped in tight iterations with full test coverage." },
  { icon: "☁", title: "Infra and Delivery", text: "Deployment pipelines, observability and cloud setups that keep releases boring and fast." },
];

const steps = [
  { n: "01", title: "Listen", text: "We map your product, market and users to find the highest-impact bets." },
  { n: "02", title: "Shape", text: "Rough sketches become tested, polished interfaces backed by a shared system." },
  { n: "03", title: "Ship", text: "Engineers deliver in short cycles with staging previews you can click through." },
  { n: "04", title: "Grow", text: "After launch we watch real usage and keep tuning what matters most." },
];

const work = [
  { tag: "FinTech · Design", title: "Ledgerly Console Refresh", tone: "a" },
  { tag: "SaaS · Engineering", title: "Chartfox Insights Suite", tone: "b" },
  { tag: "HealthTech · Brand", title: "Vitalpath Care App", tone: "c" },
];

const quotes = [
  { text: "They rewired our signup journey in weeks and the numbers moved almost overnight. Genuinely impressive pace.", name: "Amara Feld", role: "Head of Product, Ledgerly" },
  { text: "It felt less like hiring an agency and more like unlocking a senior team we could not have recruited ourselves.", name: "Tomas Reine", role: "CTO, Chartfox" },
  { text: "Clear scope, honest timelines, and the final build went beyond what we asked for. We renewed immediately.", name: "Priya Anand", role: "Founder, Vitalpath" },
];

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href="#">Kovento<span>.</span></a>
          <nav className="nav">
            <a href="#services">Services</a>
            <a href="#work">Work</a>
            <a href="#process">Process</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </nav>
          <a className="btn btn-accent" href="#">Get Started</a>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Trusted by 300+ product teams</p>
          <h1>Design, build and scale digital products that earn their keep.</h1>
          <p className="lede">
            Kovento is a fictional studio of strategists, designers and engineers
            who plug into your roadmap and ship measurable outcomes for
            software-driven companies.
          </p>
          <div className="hero-cta">
            <a className="btn btn-accent" href="#">Start a Project</a>
            <a className="btn btn-ghost" href="#services">Explore Services</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="stat-card big">
            <span className="stat-live">Live</span>
            <strong>+132%</strong>
            <p>Activation lift</p>
          </div>
          <div className="stat-card">
            <strong>9.8k</strong>
            <p>Weekly active users</p>
          </div>
          <div className="stat-card">
            <strong>3.1x</strong>
            <p>Average ROI in 6 months</p>
          </div>
        </div>
      </section>

      <section className="clients container">
        <p className="clients-label">Powering product teams at</p>
        <div className="clients-row">
          {["Ledgerly", "Chartfox", "Vitalpath", "Bramble", "Ostium", "Kelora"].map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </section>

      <section id="services" className="services container">
        <p className="eyebrow">What we do</p>
        <h2>Capabilities built for modern product teams</h2>
        <div className="service-grid">
          {services.map((s) => (
            <article key={s.title} className="service-card">
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <a className="more" href="#">Learn more →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="why container">
        <div className="why-art" aria-hidden="true">
          <div className="why-glow" />
          <div className="why-badge">Top Rated Studio<br />2026</div>
        </div>
        <div className="why-copy">
          <p className="eyebrow">Why Kovento</p>
          <h2>A senior crew, embedded in your workflow</h2>
          <p className="lede">
            No handoffs into the void. Our people work inside your tools every day,
            like teammates you did not have to recruit.
          </p>
          <ul className="why-list">
            <li><strong>Senior specialists only</strong> — the people you meet are the people who build.</li>
            <li><strong>Open weekly cadences</strong> with shared boards and live demos.</li>
            <li><strong>Flexible engagements</strong> — project, retainer or team extension.</li>
          </ul>
          <div className="stats-row">
            <div><strong>340+</strong><span>Projects shipped</span></div>
            <div><strong>11 yrs</strong><span>In the field</span></div>
            <div><strong>94%</strong><span>Client retention</span></div>
            <div><strong>28</strong><span>Countries served</span></div>
          </div>
        </div>
      </section>

      <section id="process" className="process container">
        <p className="eyebrow">How we work</p>
        <h2>A proven four-step delivery rhythm</h2>
        <div className="step-grid">
          {steps.map((s) => (
            <article key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="work" className="work container">
        <p className="eyebrow">Selected work</p>
        <h2>Case studies that carry their own weight</h2>
        <div className="work-grid">
          {work.map((w) => (
            <article key={w.title} className={`work-card tone-${w.tone}`}>
              <div className="work-visual" />
              <p className="work-tag">{w.tag}</p>
              <h3>{w.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="quotes container">
        <p className="eyebrow">Client feedback</p>
        <h2>Words from the teams we serve</h2>
        <div className="quote-grid">
          {quotes.map((q) => (
            <blockquote key={q.name} className="quote">
              <span className="stars">★★★★★</span>
              <p>&ldquo;{q.text}&rdquo;</p>
              <footer>
                <span className="avatar">{q.name.charAt(0)}</span>
                <span><strong>{q.name}</strong><br />{q.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="cta container">
        <div className="cta-box">
          <h2>Ready to build something worth shipping?</h2>
          <p>Book a free strategy call — thirty minutes, zero sales script.</p>
          <a className="btn btn-accent" href="#">Book a Call</a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <p>© 2026 Kovento. A fictional agency built for demo purposes.</p>
        </div>
      </footer>
    </div>
  );
}
