import { useState } from "react";

const figures = [
  { value: "$2.4B", label: "Client value created since 2015" },
  { value: "340+", label: "Engagements delivered across 27 markets" },
  { value: "94%", label: "Of clients retain us beyond the first mandate" },
  { value: "18", label: "Former C-suite executives among our partners" },
];

const practices = [
  {
    num: "01",
    title: "Corporate Strategy",
    text: "Portfolio design, market entry and capital allocation for boards facing consequential choices.",
  },
  {
    num: "02",
    title: "Operational Excellence",
    text: "Cost architecture, supply chain resilience and margin programs measured in basis points, not slides.",
  },
  {
    num: "03",
    title: "M&A and Integration",
    text: "Diligence, valuation discipline and the first hundred days executed against a single accountable plan.",
  },
  {
    num: "04",
    title: "Digital and Data",
    text: "Technology economics, build-versus-buy decisions and data platforms that survive audit.",
  },
];

const barData = [
  { label: "Financial services", pct: 34 },
  { label: "Industrials & energy", pct: 27 },
  { label: "Healthcare & life sciences", pct: 21 },
  { label: "Technology & media", pct: 18 },
];

const cases = [
  {
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=70",
    sector: "Banking — EMEA",
    title: "Repositioning a universal bank's corporate franchise",
    result: "+220bps return on tangible equity within 18 months",
  },
  {
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=70",
    sector: "Industrials — North America",
    title: "Post-merger integration of two logistics networks",
    result: "$310M in synergies captured, 9 months ahead of plan",
  },
  {
    img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=70",
    sector: "Healthcare — APAC",
    title: "Market entry strategy for a diagnostics platform",
    result: "Regulatory approval in 3 markets; first revenue in year one",
  },
];

const leaders = [
  {
    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70",
    name: "Marcus Feld",
    role: "Managing Partner",
    bio: "Former group CFO. Leads the firm's financial services practice.",
  },
  {
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70",
    name: "Ingrid Salzer",
    role: "Senior Partner, Strategy",
    bio: "Two decades advising boards on portfolio and capital decisions.",
  },
  {
    img: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=70",
    name: "David Okonkwo",
    role: "Partner, M&A",
    bio: "Has led diligence on transactions exceeding $40B in aggregate.",
  },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", message: "" });

  return (
    <div className="page">
      {/* Topbar */}
      <header className="topbar">
        <a className="wordmark" href="#top">
          QUANTUM<span>PARTNERS</span>
        </a>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? "✕" : "☰"}
        </button>
        <nav className={`nav ${menuOpen ? "open" : ""}`}>
          <a href="#practices">Practices</a>
          <a href="#evidence">Evidence</a>
          <a href="#cases">Case Studies</a>
          <a href="#leadership">Leadership</a>
          <a href="#contact" className="nav-contact">Start a conversation</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero" id="top">
        <div className="hero-grid">
          <div className="hero-main">
            <p className="rule-label">Strategy · Operations · Transactions</p>
            <h1>
              Advice that survives contact with the <span className="copper">balance sheet.</span>
            </h1>
            <p className="hero-sub">
              Quantum Partners advises boards and chief executives on decisions where the cost of
              being wrong is measured in billions. We are retained for judgment, not decks.
            </p>
            <div className="hero-actions">
              <a href="#contact" className="btn-solid">Engage the firm</a>
              <a href="#cases" className="btn-outline">Review our work</a>
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-fact">
              <span className="hero-fact-num">27</span>
              <span className="hero-fact-label">markets served</span>
            </div>
            <div className="hero-fact">
              <span className="hero-fact-num">2015</span>
              <span className="hero-fact-label">firm founded</span>
            </div>
            <div className="hero-fact">
              <span className="hero-fact-num">6</span>
              <span className="hero-fact-label">global offices</span>
            </div>
          </div>
        </div>
      </section>

      {/* Key figures */}
      <section className="figures">
        {figures.map((f) => (
          <div className="figure" key={f.value}>
            <span className="figure-value">{f.value}</span>
            <span className="figure-label">{f.label}</span>
          </div>
        ))}
      </section>

      {/* Practices */}
      <section className="practices" id="practices">
        <div className="sec-rule">
          <span className="sec-num">§1</span>
          <h2>Practice areas</h2>
        </div>
        <div className="practice-grid">
          {practices.map((p) => (
            <article className="practice" key={p.num}>
              <span className="practice-num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <a href="#contact" className="practice-link">Discuss a mandate →</a>
            </article>
          ))}
        </div>
      </section>

      {/* Evidence — CSS charts */}
      <section className="evidence" id="evidence">
        <div className="sec-rule">
          <span className="sec-num">§2</span>
          <h2>Where the work concentrates</h2>
        </div>
        <div className="charts">
          <div className="chart-block">
            <div className="donut" aria-hidden="true">
              <div className="donut-hole">
                <span>340+</span>
                <small>engagements</small>
              </div>
            </div>
            <ul className="legend">
              <li><i className="sw sw-1" /> Financial services — 34%</li>
              <li><i className="sw sw-2" /> Industrials & energy — 27%</li>
              <li><i className="sw sw-3" /> Healthcare — 21%</li>
              <li><i className="sw sw-4" /> Technology — 18%</li>
            </ul>
          </div>
          <div className="chart-block">
            <h3 className="chart-title">Engagement mix by sector, 2016–2026</h3>
            {barData.map((b) => (
              <div className="bar-row" key={b.label}>
                <span className="bar-label">{b.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${b.pct}%` }} />
                </div>
                <span className="bar-pct">{b.pct}%</span>
              </div>
            ))}
            <p className="chart-note">Source: internal engagement ledger, audited annually.</p>
          </div>
        </div>
      </section>

      {/* Case studies */}
      <section className="cases" id="cases">
        <div className="sec-rule">
          <span className="sec-num">§3</span>
          <h2>Selected case studies</h2>
        </div>
        <div className="case-grid">
          {cases.map((c) => (
            <article className="case" key={c.title}>
              <div className="case-media">
                <img src={c.img} alt={c.sector} loading="lazy" />
              </div>
              <p className="case-sector">{c.sector}</p>
              <h3>{c.title}</h3>
              <p className="case-result">{c.result}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Leadership */}
      <section className="leadership" id="leadership">
        <div className="sec-rule">
          <span className="sec-num">§4</span>
          <h2>Leadership</h2>
        </div>
        <div className="leader-grid">
          {leaders.map((l) => (
            <article className="leader" key={l.name}>
              <img src={l.img} alt={l.name} loading="lazy" />
              <h3>{l.name}</h3>
              <p className="leader-role">{l.role}</p>
              <p className="leader-bio">{l.bio}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="contact" id="contact">
        <div className="contact-grid">
          <div className="contact-copy">
            <p className="rule-label">§5 — Contact</p>
            <h2>Begin with a confidential conversation</h2>
            <p>
              First discussions are held under NDA at no charge. Within ten business days you will
              receive a written point of view — whether or not we propose an engagement.
            </p>
            <address>
              Quantum Partners LLP
              <br />
              One Exchange Square, London EC2A
              <br />
              mandates@quantumpartners.com
            </address>
          </div>
          {sent ? (
            <div className="contact-form contact-thanks">
              <h3>Received.</h3>
              <p>A partner will respond within two business days.</p>
            </div>
          ) : (
            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.name && form.company) setSent(true);
              }}
            >
              <label>
                Full name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label>
                Company
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
              </label>
              <label>
                The decision you are facing
                <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </label>
              <button type="submit" className="btn-solid">Submit inquiry</button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-row">
          <span className="wordmark">QUANTUM<span>PARTNERS</span></span>
          <nav className="footer-nav">
            <a href="#practices">Practices</a>
            <a href="#cases">Case studies</a>
            <a href="#leadership">Leadership</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
        <div className="footer-base">
          <span>© 2026 Quantum Partners LLP. All rights reserved.</span>
          <span>London · New York · Singapore · Frankfurt · Dubai · Tokyo</span>
        </div>
      </footer>
    </div>
  );
}
