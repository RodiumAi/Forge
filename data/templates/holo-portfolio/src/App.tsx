import { useState } from "react";

const projects = [
  {
    img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=70",
    index: "01",
    title: "SYNTH/WAVE",
    desc: "Generative audio-reactive visuals for a synthwave label's world tour. Realtime WebGL, 60fps on stage screens.",
    tags: ["WebGL", "GLSL", "Audio API"],
    year: "2026",
  },
  {
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=70",
    index: "02",
    title: "NEON GRID",
    desc: "Interactive data sculpture for a fintech lobby — 40,000 particles mapping live market flow onto a 6m LED wall.",
    tags: ["Three.js", "TypeScript", "LED"],
    year: "2025",
  },
  {
    img: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=70",
    index: "03",
    title: "MORPH OS",
    desc: "Concept operating system UI for a sci-fi feature film. 200+ animated screens, all shipped as production plates.",
    tags: ["Motion", "UI Design", "Film"],
    year: "2025",
  },
  {
    img: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&q=70",
    index: "04",
    title: "LIQUID BRAND",
    desc: "A living identity system for an AI startup — the logo is a fluid simulation that reacts to product uptime.",
    tags: ["Branding", "Shaders", "AI"],
    year: "2024",
  },
];

const skills = [
  { name: "Creative coding / WebGL", pct: 95 },
  { name: "Motion design", pct: 90 },
  { name: "Brand systems", pct: 82 },
  { name: "3D & shaders", pct: 88 },
  { name: "Frontend engineering", pct: 85 },
];

const services = [
  { icon: "◢", title: "Immersive Web", text: "Sites that feel like installations. WebGL, scroll choreography, zero templates." },
  { icon: "◈", title: "Live Visuals", text: "Stage and installation graphics driven by sound, data or crowd motion." },
  { icon: "◮", title: "Identity in Motion", text: "Brand systems designed to move first and print second." },
];

const process = [
  {
    num: "①",
    title: "Decode",
    text: "One week of questions. I dig until I understand what your audience actually feels.",
  },
  {
    num: "②",
    title: "Prototype",
    text: "Rough, real and interactive within days. We judge motion on screen, never on slides.",
  },
  {
    num: "③",
    title: "Polish",
    text: "Frame-by-frame tuning until 60fps is boringly reliable on a five-year-old phone.",
  },
  {
    num: "④",
    title: "Launch",
    text: "Handover with docs, source and a recorded walkthrough. No black boxes left behind.",
  },
];

const press = [
  "AWWWARDS × SITE OF THE DAY",
  "FWA × PROJECT OF THE MONTH",
  "WIRED × FEATURED ARTIST",
  "IT'S NICE THAT × INTERVIEW",
];

export default function App() {
  const [active, setActive] = useState(0);
  const project = projects[active];

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />

      {/* Navbar */}
      <header className="nav">
        <a className="logo" href="#top">
          META<span>MORPH</span>
        </a>
        <nav className="nav-links">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#contact" className="nav-pill">Let's talk</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero" id="top">
        <p className="hero-tag">Creative technologist — Berlin / remote</p>
        <h1 className="mega">
          I BUILD
          <br />
          <span className="mega-grad">IMPOSSIBLE</span>
          <br />
          INTERFACES
        </h1>
        <p className="hero-sub">
          Ten years turning briefs into things people screenshot. WebGL experiences, live visuals,
          and brands that refuse to sit still.
        </p>
        <div className="hero-meta">
          <span className="pill">Available Q3 2026</span>
          <span className="pill pill-ghost">4 awards · 40+ shipped projects</span>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>10y</strong>
            <span>in the field</span>
          </div>
          <div className="hero-stat">
            <strong>40+</strong>
            <span>projects shipped</span>
          </div>
          <div className="hero-stat">
            <strong>60fps</strong>
            <span>or it doesn't ship</span>
          </div>
        </div>
        <a href="#work" className="scroll-cue" aria-label="Scroll to work">↓</a>
      </section>

      {/* Work — section cursor with big arrows */}
      <section className="work" id="work">
        <div className="work-head">
          <h2 className="section-title">
            SELECTED <span className="mega-grad">WORK</span>
          </h2>
          <div className="work-cursor">
            <button
              className="arrow"
              onClick={() => setActive((active - 1 + projects.length) % projects.length)}
              aria-label="Previous project"
            >
              ←
            </button>
            <span className="work-count">
              {project.index} / 0{projects.length}
            </span>
            <button
              className="arrow"
              onClick={() => setActive((active + 1) % projects.length)}
              aria-label="Next project"
            >
              →
            </button>
          </div>
        </div>

        <article className="holo-card" key={project.index}>
          <div className="holo-sheen" aria-hidden="true" />
          <div className="holo-media">
            <img src={project.img} alt={project.title} />
          </div>
          <div className="holo-body">
            <span className="holo-index">{project.index}</span>
            <h3>{project.title}</h3>
            <p>{project.desc}</p>
            <div className="tag-row">
              {project.tags.map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </div>
            <span className="holo-year">{project.year}</span>
          </div>
        </article>

        <div className="work-grid">
          {projects.map((p, i) => (
            <button
              key={p.index}
              className={`work-thumb ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
            >
              <img src={p.img} alt={p.title} loading="lazy" />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="services" id="services">
        <h2 className="section-title">
          WHAT I <span className="mega-grad">DO</span>
        </h2>
        <div className="service-grid">
          {services.map((s) => (
            <article className="service" key={s.title}>
              <span className="service-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* About + skills */}
      <section className="about" id="about">
        <div className="about-media">
          <img
            src="https://images.unsplash.com/photo-1617042375876-a13e36732a04?auto=format&fit=crop&w=1200&q=70"
            alt="Studio workspace"
            loading="lazy"
          />
        </div>
        <div className="about-copy">
          <h2 className="section-title">
            ABOUT <span className="mega-grad">ME</span>
          </h2>
          <p>
            I'm Kaito Reyes — one person, one studio, zero account managers. I studied physics,
            fell into shaders, and never climbed out. Clients include record labels, film studios
            and startups that want their product to feel like the future arrived early.
          </p>
          <div className="skills">
            {skills.map((s) => (
              <div className="skill" key={s.name}>
                <div className="skill-row">
                  <span>{s.name}</span>
                  <span className="skill-pct">{s.pct}%</span>
                </div>
                <div className="skill-track">
                  <div className="skill-fill" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Press marquee */}
      <div className="press" aria-hidden="true">
        <div className="press-track">
          {[0, 1].map((n) => (
            <span key={n} className="press-seg">
              {press.map((p) => (
                <span className="press-item" key={p}>{p} ✦ </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Process */}
      <section className="process">
        <h2 className="section-title">
          THE <span className="mega-grad">PROCESS</span>
        </h2>
        <div className="process-grid">
          {process.map((s) => (
            <article className="process-step" key={s.title}>
              <span className="process-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="contact" id="contact">
        <h2 className="mega mega-contact">
          <span className="mega-grad">LET'S MAKE</span>
          <br />
          SOMETHING UNREAL
        </h2>
        <p className="contact-sub">One project at a time. Booking for autumn 2026.</p>
        <a className="contact-mail" href="#contact">hello@metamorph.studio</a>
        <div className="tag-row contact-tags">
          <span className="tag">Berlin</span>
          <span className="tag">Remote worldwide</span>
          <span className="tag">Replies in 24h</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <span className="logo">META<span>MORPH</span></span>
        <div className="footer-links">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
        <span className="footer-note">© 2026 — Designed & coded by one human</span>
      </footer>
    </div>
  );
}
