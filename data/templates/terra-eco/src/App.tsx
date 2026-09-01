import { useState } from "react";

const NAV = ["Mission", "Impact", "Projects", "Standards", "Join"];

const IMPACT = [
  { n: 1200000, display: "1.2M", label: "Trees planted since 2019", icon: "🌱" },
  { n: 84, display: "84", label: "Regenerative farms supported", icon: "🌾" },
  { n: 46000, display: "46K", label: "Tonnes of CO₂ sequestered", icon: "🌍" },
  { n: 310, display: "310", label: "Hectares of wetland restored", icon: "💧" },
];

const PROJECTS = [
  {
    title: "Miyawaki micro-forests, Lyon",
    tag: "Urban rewilding",
    desc: "Dense native forests on former parking lots. 27 pocket forests planted with schools and city crews — canopy closure expected in 4 years instead of 20.",
    img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Living-soil transition, Occitanie",
    tag: "Regenerative agriculture",
    desc: "We fund the risky first three years when farmers drop synthetic inputs. 84 farms enrolled; average soil organic matter up 1.8 points.",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Seagrass nurseries, Brittany coast",
    tag: "Blue carbon",
    desc: "Zostera meadows sequester carbon 35× faster than rainforest. Our divers replanted 12 hectares with local fishing cooperatives.",
    img: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1200&q=70",
  },
  {
    title: "Mangrove corridor, Casamance",
    tag: "Coastal restoration",
    desc: "Community-led replanting of 900,000 propagules across estuary villages — storm protection and fish stocks returning together.",
    img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=70",
  },
];

const BADGES = [
  { name: "B Corp Certified", detail: "Score 118.4 — recertified 2026", icon: "◉" },
  { name: "1% for the Planet", detail: "Member since 2020", icon: "✦" },
  { name: "Gold Standard", detail: "All carbon projects verified", icon: "❋" },
  { name: "Science Based Targets", detail: "Net-zero pathway validated", icon: "◈" },
];

const STEPS = [
  { n: "01", title: "Measure honestly", desc: "Full scope 1–3 accounting with open methodology. No creative boundaries, no offsets counted as reductions." },
  { n: "02", title: "Reduce first", desc: "We only fund removal for what genuinely cannot be reduced yet. Reduction roadmaps come before any credit purchase." },
  { n: "03", title: "Regenerate locally", desc: "Every euro flows to projects with named stewards, GPS-verified plots and five-year monitoring you can visit." },
];

function Wave({ flip, fill }: { flip?: boolean; fill: string }) {
  return (
    <div className={flip ? "wave flip" : "wave"} aria-hidden>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path
          d="M0,48 C240,90 480,6 720,42 C960,78 1200,18 1440,54 L1440,90 L0,90 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

export default function App() {
  const [counted, setCounted] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden>❧</span> Terra Collective
        </a>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
          ))}
        </nav>
        <a className="btn btn-accent" href="#join">Support a project</a>
      </header>

      {/* ── Hero ── */}
      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Regeneration, not just sustainability</span>
          <h1 className="h1">
            The earth doesn&apos;t need saving.<br />
            It needs <em>partners</em>.
          </h1>
          <p className="lede">
            Terra Collective connects businesses and citizens to verified regenerative
            projects — forests, soils, coasts — with radical transparency on where
            every euro lands.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-accent" href="#projects">Explore projects</a>
            <a className="btn btn-outline" href="#impact">See our impact ↓</a>
          </div>
          <div className="hero-note">🌿 118.4 B Corp score · audited annually</div>
        </div>
        <div className="hero-visual">
          <div className="blob blob-back" aria-hidden />
          <img
            className="blob-img"
            src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70"
            alt="Sunlight through a dense forest canopy"
          />
          <div className="blob-badge">Since 2019</div>
        </div>
      </section>

      <Wave fill="#3d5a3c" />

      {/* ── Impact counters ── */}
      <section className="impact" id="impact">
        <h2 className="h2 light">What regeneration looks like, counted.</h2>
        <p className="section-sub light">
          Every number below links to public plot data, steward names and monitoring
          reports. Click any counter in the live dashboard to drill down.
        </p>
        <div className="impact-grid" onMouseEnter={() => setCounted(true)}>
          {IMPACT.map((s) => (
            <div className={counted ? "impact-card grow" : "impact-card"} key={s.label}>
              <span className="impact-icon" aria-hidden>{s.icon}</span>
              <div className="impact-n">{s.display}</div>
              <div className="impact-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <Wave flip fill="#3d5a3c" />

      {/* ── Mission / How we work ── */}
      <section className="section" id="mission">
        <div className="section-head center">
          <span className="eyebrow">How we work</span>
          <h2 className="h2">Three rules we never bend</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <article className="step" key={s.n}>
              <div className="step-n">{s.n}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </article>
          ))}
        </div>
        <div className="mission-band">
          <img
            className="mission-img"
            src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=70"
            alt="Hands holding a young seedling in rich soil"
          />
          <blockquote className="mission-quote">
            “Sustainability asks how to do less harm. Regeneration asks how a place
            becomes more alive each year because you were there.”
            <cite>— Nadia Ferreira, co-founder</cite>
          </blockquote>
        </div>
      </section>

      <Wave fill="#dcd6c4" />

      {/* ── Projects ── */}
      <section className="section alt" id="projects">
        <div className="section-head center">
          <span className="eyebrow">Active projects</span>
          <h2 className="h2">Where your support takes root</h2>
        </div>
        <div className="project-grid">
          {PROJECTS.map((p, i) => (
            <article className={i % 2 ? "project reverse" : "project"} key={p.title}>
              <div className="project-photo">
                <img src={p.img} alt={p.title} loading="lazy" />
              </div>
              <div className="project-body">
                <span className="project-tag">{p.tag}</span>
                <h3 className="project-title">{p.title}</h3>
                <p className="project-desc">{p.desc}</p>
                <a className="project-link" href="#join">View plot data →</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Wave flip fill="#dcd6c4" />

      {/* ── Certifications ── */}
      <section className="section" id="standards">
        <div className="section-head center">
          <span className="eyebrow">Standards & proof</span>
          <h2 className="h2">Certified, audited, published</h2>
          <p className="section-sub">
            We hold ourselves to the strictest third-party standards available —
            and publish every audit in full, including the uncomfortable parts.
          </p>
        </div>
        <div className="badge-grid">
          {BADGES.map((b) => (
            <div className="badge" key={b.name}>
              <span className="badge-icon" aria-hidden>{b.icon}</span>
              <div>
                <div className="badge-name">{b.name}</div>
                <div className="badge-detail">{b.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Wave fill="#3d5a3c" />

      {/* ── Voices from the field ── */}
      <section className="section" id="voices">
        <div className="section-head center">
          <span className="eyebrow">Voices from the field</span>
          <h2 className="h2">The people doing the planting</h2>
        </div>
        <div className="steps">
          <article className="step">
            <div className="step-n">“</div>
            <h3 className="step-title">Bakary Sané — Casamance steward</h3>
            <p className="step-desc">
              “Ten years ago the estuary took our rice fields. This season the
              mangroves held the storm surge, and the shrimp came back with them.
              My son now runs the nursery.”
            </p>
          </article>
          <article className="step">
            <div className="step-n">“</div>
            <h3 className="step-title">Claire Mathieu — farmer, Occitanie</h3>
            <p className="step-desc">
              “Terra covered the yield dip of my transition years. Year three:
              same revenue, half the input costs, and earthworms I hadn't seen
              since my grandfather's time.”
            </p>
          </article>
          <article className="step">
            <div className="step-n">“</div>
            <h3 className="step-title">Dr. Ana Beltrán — marine ecologist</h3>
            <p className="step-desc">
              “Most restoration funding is a photo op. Terra funds the boring
              part — five years of monitoring — which is the only part that
              tells you whether the meadow survived.”
            </p>
          </article>
        </div>
      </section>

      <Wave fill="#3d5a3c" />

      {/* ── Join / CTA ── */}
      <section className="join" id="join">
        <div className="blob blob-cta" aria-hidden />
        <h2 className="h2 light">Put roots in the ground this quarter.</h2>
        <p className="section-sub light">
          For teams: offset honestly and fund regeneration from €190/month.
          For citizens: adopt a plot from €8/month. Cancel anytime; the trees stay.
        </p>
        {joined ? (
          <p className="join-done">🌱 Welcome to the collective — check your inbox for your first plot.</p>
        ) : (
          <form
            className="join-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setJoined(true);
            }}
          >
            <input
              className="join-input"
              type="email"
              placeholder="you@company.earth"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn btn-accent" type="submit">Join Terra</button>
          </form>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand"><span aria-hidden>❧</span> Terra Collective</div>
            <p className="footer-tag">Regeneration, measured and shared.</p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <a href="#projects">Projects</a>
            <a href="#impact">Impact dashboard</a>
            <a href="#standards">Methodology</a>
          </div>
          <div className="footer-col">
            <h4>Organisation</h4>
            <a href="#mission">Our mission</a>
            <a href="#top">Annual reports</a>
            <a href="#top">Careers</a>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <a href="#top">hello@terra.earth</a>
            <a href="#top">Press kit</a>
            <a href="#top">Partner with us</a>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 Terra Collective SCIC — Lyon, France · Printed nothing to make this site.
        </div>
      </footer>
    </div>
  );
}
