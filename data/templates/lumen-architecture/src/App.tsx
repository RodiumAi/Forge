import { useState } from "react";

const projects = [
  {
    num: "01",
    title: "Meridian House",
    place: "Marfa, Texas",
    year: "2025",
    type: "Private residence",
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70",
    size: "wide",
  },
  {
    num: "02",
    title: "Kiln Pavilion",
    place: "Kyoto, Japan",
    year: "2024",
    type: "Cultural pavilion",
    img: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=70",
    size: "narrow",
  },
  {
    num: "03",
    title: "Vault Gallery",
    place: "Copenhagen, Denmark",
    year: "2024",
    type: "Contemporary art gallery",
    img: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=70",
    size: "narrow",
  },
  {
    num: "04",
    title: "Slate Courtyard",
    place: "Zürich, Switzerland",
    year: "2023",
    type: "Headquarters & atrium",
    img: "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=1200&q=70",
    size: "wide",
  },
];

const services = [
  {
    num: "01",
    title: "Architecture",
    text: "Complete building design from feasibility to handover. We lead every drawing set ourselves — nothing is delegated past the studio door.",
  },
  {
    num: "02",
    title: "Interiors",
    text: "Interior architecture conceived with the building, never after it. Joinery, stone, light fittings and thresholds detailed to the millimetre.",
  },
  {
    num: "03",
    title: "Master planning",
    text: "Urban fragments and campus plans that privilege the pedestrian, the courtyard and the long view over the diagram.",
  },
  {
    num: "04",
    title: "Adaptive reuse",
    text: "We treat existing fabric as the most sustainable material available. Careful subtraction before any addition.",
  },
];

const team = [
  {
    name: "Elias Vantorre",
    role: "Founding Principal",
    bio: "RIBA. Formerly senior associate at Herzog & de Meuron, Basel. Teaches at the AA.",
    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Naomi Achterberg",
    role: "Principal, Interiors",
    bio: "Led the Vault Gallery interiors. Obsessed with the junction between timber and stone.",
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Tomas Ferreira",
    role: "Director, Technical",
    bio: "Twenty years of construction documentation. The person contractors call before they call anyone else.",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70",
  },
];

const press = [
  { outlet: "Architectural Review", note: "Emerging Practice of the Year, shortlist — 2025" },
  { outlet: "Dezeen", note: "Kiln Pavilion: 'a lesson in restraint' — 2024" },
  { outlet: "Wallpaper*", note: "Top 20 studios to watch — 2024" },
  { outlet: "Domus", note: "Meridian House, cover feature — 2025" },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  return (
    <div className="page">
      {/* ---------- Navbar ---------- */}
      <header className="nav">
        <a className="nav-logo" href="#top">
          Lumen<span className="nav-logo-dot">.</span>Atelier
        </a>
        <nav className={"nav-links" + (menuOpen ? " open" : "")}>
          <a href="#work" onClick={() => setMenuOpen(false)}>Work</a>
          <a href="#philosophy" onClick={() => setMenuOpen(false)}>Philosophy</a>
          <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
          <a href="#studio" onClick={() => setMenuOpen(false)}>Studio</a>
          <a href="#contact" className="nav-cta" onClick={() => setMenuOpen(false)}>
            Start a project
          </a>
        </nav>
        <button
          className="nav-burger"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="hero" id="top">
        <p className="hero-kicker">Architecture &amp; Interiors — London / Kyoto</p>
        <h1 className="hero-title">
          Buildings that hold
          <br />
          <em>light</em> the way a room
          <br />
          holds a conversation.
        </h1>
        <div className="hero-meta">
          <p className="hero-lede">
            Lumen Atelier is a fourteen-person practice working on residences,
            galleries and civic pavilions across three continents. We build
            slowly, draw everything, and finish what we start.
          </p>
          <a className="hero-link" href="#work">
            Selected work <span className="arrow">→</span>
          </a>
        </div>
        <figure className="hero-figure">
          <img
            src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=70"
            alt="White concrete building under strong daylight"
          />
          <figcaption>Meridian House — west elevation, 7:40 am</figcaption>
        </figure>
      </section>

      {/* ---------- Marquee strip ---------- */}
      <div className="strip">
        <span>Est. 2011</span>
        <span className="strip-rule" />
        <span>38 built projects</span>
        <span className="strip-rule" />
        <span>11 countries</span>
        <span className="strip-rule" />
        <span>RIBA Chartered Practice</span>
        <span className="strip-rule" />
        <span>Carbon-audited since 2019</span>
      </div>

      {/* ---------- Work ---------- */}
      <section className="section" id="work">
        <div className="section-head">
          <span className="section-num">01</span>
          <h2 className="section-title">Selected work</h2>
          <p className="section-sub">Four projects, 2023 — 2025</p>
        </div>
        <div className="work-grid">
          {projects.map((p) => (
            <article
              key={p.num}
              className={"work-card " + p.size + (activeProject === p.num ? " active" : "")}
              onMouseEnter={() => setActiveProject(p.num)}
              onMouseLeave={() => setActiveProject(null)}
            >
              <div className="work-img">
                <img src={p.img} alt={p.title} />
              </div>
              <div className="work-meta">
                <span className="work-num">{p.num}</span>
                <h3 className="work-title">{p.title}</h3>
                <p className="work-detail">
                  {p.type} · {p.place} · {p.year}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Philosophy ---------- */}
      <section className="section philosophy" id="philosophy">
        <div className="section-head">
          <span className="section-num">02</span>
          <h2 className="section-title">Philosophy</h2>
        </div>
        <div className="philosophy-grid">
          <figure className="philosophy-figure">
            <img
              src="https://images.unsplash.com/photo-1481253127861-534498168948?auto=format&fit=crop&w=1200&q=70"
              alt="Minimal stairwell with natural light"
            />
            <figcaption>Vault Gallery — stair core</figcaption>
          </figure>
          <div className="philosophy-copy">
            <p className="philosophy-lead">
              “A plan is a promise. We make very few, and we keep all of them.”
            </p>
            <p>
              We believe a building should be understood in one walk-through
              and rewarded on the hundredth. Our work begins with the section —
              how light falls, how air moves, where a person pauses — and only
              then addresses the facade.
            </p>
            <p>
              Every project is drawn by hand before it is modelled. The studio
              maintains a single material library, audited yearly: we would
              rather master forty materials than sample four hundred.
            </p>
            <ul className="philosophy-list">
              <li><span>—</span> Light before form, form before finish.</li>
              <li><span>—</span> Every detail drawn at 1:5 or it doesn't get built.</li>
              <li><span>—</span> Retrofit first; demolition is a last resort.</li>
              <li><span>—</span> One accent material per building, never more.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="section" id="services">
        <div className="section-head">
          <span className="section-num">03</span>
          <h2 className="section-title">What we do</h2>
          <p className="section-sub">Full scope, one team</p>
        </div>
        <div className="services-grid">
          {services.map((s) => (
            <div className="service" key={s.num}>
              <span className="service-num">{s.num}</span>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-text">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Studio / Team ---------- */}
      <section className="section" id="studio">
        <div className="section-head">
          <span className="section-num">04</span>
          <h2 className="section-title">The studio</h2>
          <p className="section-sub">Three principals, one drawing board</p>
        </div>
        <div className="team-grid">
          {team.map((m) => (
            <article className="team-card" key={m.name}>
              <div className="team-img">
                <img src={m.img} alt={m.name} />
              </div>
              <h3 className="team-name">{m.name}</h3>
              <p className="team-role">{m.role}</p>
              <p className="team-bio">{m.bio}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Press ---------- */}
      <section className="section press">
        <div className="section-head">
          <span className="section-num">05</span>
          <h2 className="section-title">Recognition</h2>
        </div>
        <ul className="press-list">
          {press.map((p) => (
            <li className="press-row" key={p.outlet}>
              <span className="press-outlet">{p.outlet}</span>
              <span className="press-note">{p.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Contact CTA ---------- */}
      <section className="contact" id="contact">
        <h2 className="contact-title">
          We take on six
          <br />
          projects a year.
        </h2>
        <p className="contact-sub">
          Commissions for 2027 open in September. Write to us with a site, a
          brief, or simply an ambition.
        </p>
        <a className="contact-btn" href="mailto:studio@lumenatelier.com">
          studio@lumenatelier.com <span className="arrow">→</span>
        </a>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="footer-cols">
          <div>
            <p className="footer-logo">Lumen.Atelier</p>
            <p className="footer-small">
              14 Fournier Street
              <br />
              London E1 6QE
            </p>
          </div>
          <div>
            <p className="footer-head">Studio</p>
            <a href="#work">Work</a>
            <a href="#philosophy">Philosophy</a>
            <a href="#studio">People</a>
          </div>
          <div>
            <p className="footer-head">Elsewhere</p>
            <a href="#top">Instagram</a>
            <a href="#top">Are.na</a>
            <a href="#top">Press kit</a>
          </div>
        </div>
        <p className="footer-legal">
          © 2026 Lumen Atelier Ltd. RIBA Chartered Practice no. 20014582.
        </p>
      </footer>
    </div>
  );
}
