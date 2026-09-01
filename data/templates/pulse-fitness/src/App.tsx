import { useState } from "react";

const programs = [
  {
    tag: "STR",
    name: "Strength",
    desc: "Barbell-first programming in 6-week blocks. Squat, pull, press — logged, coached, progressed every single session.",
    stat: "5x",
    statLabel: "weekly slots",
    img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=70",
  },
  {
    tag: "CND",
    name: "Conditioning",
    desc: "Sleds, rowers, ski ergs and bad decisions. 45 minutes of intervals engineered to raise your engine, not wreck your joints.",
    stat: "900+",
    statLabel: "kcal average burn",
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=70",
  },
  {
    tag: "BOX",
    name: "Boxing",
    desc: "Real pad work, real footwork, zero cardio-boxing fluff. Beginners welcome; egos checked at the ropes.",
    stat: "12",
    statLabel: "rounds per class",
    img: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=70",
  },
];

const stats = [
  { value: "4,200", label: "active members" },
  { value: "310", label: "classes per week" },
  { value: "97%", label: "12-month retention" },
  { value: "24/7", label: "doors never close" },
];

const results = [
  { label: "Members hitting a PR each month", pct: 82 },
  { label: "Average strength gain, first 12 weeks", pct: 64 },
  { label: "Class attendance rate", pct: 91 },
  { label: "Members who bring a friend", pct: 47 },
];

const coaches = [
  {
    name: "Dre Okafor",
    role: "Head of Strength",
    creds: "CSCS · 14 yrs · 240kg deadlift",
    img: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Mia Santoro",
    role: "Conditioning Lead",
    creds: "Ex-national 800m · CF-L3",
    img: "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Viktor Hale",
    role: "Boxing Coach",
    creds: "22-3 amateur · ABA certified",
    img: "https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?auto=format&fit=crop&w=1200&q=70",
  },
];

const plans = [
  {
    name: "OFF-PEAK",
    price: "$59",
    features: ["Access 10am–4pm", "All open-gym zones", "Locker + towel", "App tracking"],
    featured: false,
  },
  {
    name: "ALL-IN",
    price: "$99",
    features: ["24/7 access", "Unlimited classes", "Quarterly testing day", "Guest pass monthly", "Recovery zone"],
    featured: true,
  },
  {
    name: "COACHED",
    price: "$219",
    features: ["Everything in ALL-IN", "2x weekly PT sessions", "Custom programming", "Nutrition check-ins"],
    featured: false,
  },
];

const schedule = [
  { time: "06:00", mon: "Strength", wed: "Conditioning", fri: "Strength" },
  { time: "12:15", mon: "Boxing", wed: "Strength", fri: "Conditioning" },
  { time: "18:30", mon: "Conditioning", wed: "Boxing", fri: "Boxing" },
  { time: "20:00", mon: "Strength", wed: "Strength", fri: "Open mat" },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="page">
      {/* ---------- Navbar ---------- */}
      <header className="nav">
        <a className="nav-logo" href="#top">
          PULSE<span>/</span>CLUB
        </a>
        <nav className={"nav-links" + (menuOpen ? " open" : "")}>
          <a href="#programs" onClick={() => setMenuOpen(false)}>Programs</a>
          <a href="#results" onClick={() => setMenuOpen(false)}>Results</a>
          <a href="#coaches" onClick={() => setMenuOpen(false)}>Coaches</a>
          <a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a>
        </nav>
        <a className="nav-cta" href="#plans">JOIN NOW</a>
        <button className="nav-burger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "✕" : "≡"}
        </button>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="hero" id="top">
        <img
          className="hero-img"
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=70"
          alt="Dark gym floor with racks"
        />
        <div className="hero-veil" />
        <div className="hero-content">
          <p className="hero-kicker">EAST DOCKLANDS · OPEN 24/7</p>
          <h1 className="hero-title">
            TRAIN
            <br />
            <span className="stroke">LOUD.</span>
            <br />
            LIVE
            <br />
            <span className="lime">LOUDER.</span>
          </h1>
          <p className="hero-sub">
            4,200 members. 310 classes a week. Zero mirrors-and-selfies energy.
            Pulse Club is where the city's most serious amateurs come to get honestly, measurably better.
          </p>
          <div className="hero-cta">
            <a className="btn btn-lime" href="#plans">START 7-DAY TRIAL →</a>
            <a className="btn btn-out" href="#programs">SEE PROGRAMS</a>
          </div>
        </div>
      </section>

      {/* ---------- Stats band ---------- */}
      <section className="stats-band">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ---------- Programs (diagonal) ---------- */}
      <section className="section diag diag-lime" id="programs">
        <div className="section-head">
          <h2 className="section-title dark">PICK YOUR<br />POISON.</h2>
          <p className="section-sub dark">
            Three programs. All coached, all logged, all progressive. Drop-ins die here; systems win.
          </p>
        </div>
        <div className="program-grid">
          {programs.map((p) => (
            <article className="program-card" key={p.tag}>
              <div className="program-imgwrap">
                <img src={p.img} alt={p.name} />
                <span className="program-tag">{p.tag}</span>
              </div>
              <div className="program-body">
                <h3 className="program-name">{p.name}</h3>
                <p className="program-desc">{p.desc}</p>
                <div className="program-stat">
                  <span className="program-stat-value">{p.stat}</span>
                  <span className="program-stat-label">{p.statLabel}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Results / progress bars ---------- */}
      <section className="section" id="results">
        <div className="section-head">
          <h2 className="section-title">NUMBERS DON'T<br /><span className="lime">FLINCH.</span></h2>
          <p className="section-sub">
            We test every member quarterly. This is last quarter, club-wide. No cherry-picking.
          </p>
        </div>
        <div className="bars">
          {results.map((r) => (
            <div className="bar-row" key={r.label}>
              <div className="bar-head">
                <span className="bar-label">{r.label}</span>
                <span className="bar-pct">{r.pct}%</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Coaches (diagonal dark) ---------- */}
      <section className="section diag diag-carbon" id="coaches">
        <div className="section-head">
          <h2 className="section-title">THE PEOPLE<br />WHO'LL <span className="lime">PUSH YOU.</span></h2>
          <p className="section-sub">
            Every coach at Pulse still competes. If they don't practice it, they don't program it.
          </p>
        </div>
        <div className="coach-grid">
          {coaches.map((c) => (
            <article className="coach-card" key={c.name}>
              <div className="coach-imgwrap">
                <img src={c.img} alt={c.name} />
              </div>
              <h3 className="coach-name">{c.name}</h3>
              <p className="coach-role">{c.role}</p>
              <p className="coach-creds">{c.creds}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Plans ---------- */}
      <section className="section" id="plans">
        <div className="section-head">
          <h2 className="section-title">MEMBERSHIP.<br /><span className="lime">NO CONTRACTS.</span></h2>
          <p className="section-sub">
            Month to month, cancel anytime in the app. We keep members with results, not paperwork.
          </p>
        </div>
        <div className="plan-grid">
          {plans.map((p) => (
            <div className={"plan" + (p.featured ? " featured" : "")} key={p.name}>
              {p.featured && <span className="plan-flag">MOST PICKED</span>}
              <h3 className="plan-name">{p.name}</h3>
              <p className="plan-price">
                {p.price}
                <span>/mo</span>
              </p>
              <ul className="plan-list">
                {p.features.map((f) => (
                  <li key={f}>▸ {f}</li>
                ))}
              </ul>
              <a className={"btn " + (p.featured ? "btn-lime" : "btn-out")} href="#top">
                {p.featured ? "START TRIAL →" : "CHOOSE PLAN"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Schedule ---------- */}
      <section className="section" id="schedule">
        <div className="section-head">
          <h2 className="section-title">THE WEEK,<br /><span className="lime">ON THE CLOCK.</span></h2>
          <p className="section-sub">
            Sample of the peak slots. The full 310-class grid lives in the app — book up to 7 days out.
          </p>
        </div>
        <div className="sched">
          <div className="sched-row sched-head-row">
            <span>TIME</span>
            <span>MON</span>
            <span>WED</span>
            <span>FRI</span>
          </div>
          {schedule.map((s) => (
            <div className="sched-row" key={s.time}>
              <span className="sched-time">{s.time}</span>
              <span>{s.mon}</span>
              <span>{s.wed}</span>
              <span>{s.fri}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="final">
        <h2 className="final-title">
          FIRST WEEK'S <span className="stroke-dark">FREE.</span>
        </h2>
        <p className="final-sub">Walk in tonight. Doors don't close, and neither do trial spots — until they do.</p>
        <a className="btn btn-dark" href="#plans">CLAIM YOUR 7 DAYS →</a>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="footer-cols">
          <div>
            <p className="footer-logo">PULSE<span>/</span>CLUB</p>
            <p className="footer-small">
              88 Turbine Wharf, East Docklands
              <br />
              Open 24/7 · Staffed 06:00–22:00
            </p>
          </div>
          <div>
            <p className="footer-head">Club</p>
            <a href="#programs">Programs</a>
            <a href="#coaches">Coaches</a>
            <a href="#plans">Membership</a>
          </div>
          <div>
            <p className="footer-head">Social</p>
            <a href="#top">Instagram</a>
            <a href="#top">YouTube</a>
            <a href="#top">Strava club</a>
          </div>
        </div>
        <p className="footer-legal">© 2026 Pulse Club Ltd. Train hard, waive nothing — read the small print anyway.</p>
      </footer>
    </div>
  );
}
