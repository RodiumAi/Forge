import { useState } from "react";

const MARQUEE_WORDS = [
  "BRANDING",
  "WEB DESIGN",
  "MOTION",
  "PACKAGING",
  "ART DIRECTION",
  "STRATEGY",
  "NAMING",
  "CAMPAIGNS",
];

const SERVICES = [
  {
    num: "01",
    title: "Brand identity",
    text: "Logos people actually remember. Systems that survive an intern with Canva. We've rebranded 60+ companies and only two cried.",
    color: "#ffe600",
  },
  {
    num: "02",
    title: "Websites",
    text: "Fast, weird, unforgettable. No templates, no 'hero-features-testimonials' zombie layouts. Average Lighthouse score: 98.",
    color: "#ff4911",
  },
  {
    num: "03",
    title: "Motion & 3D",
    text: "Product films, loops, launch videos. If it doesn't stop the scroll in 0.4 seconds, we redo it. On our dime.",
    color: "#1a6dff",
  },
  {
    num: "04",
    title: "Campaigns",
    text: "Out-of-home that makes people photograph a billboard. Social that gets stolen and reposted. That's the metric.",
    color: "#f5f0e8",
  },
];

const PROJECTS = [
  {
    title: "MOSHPIT ENERGY",
    tag: "Brand + Packaging",
    year: "2026",
    img: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=70",
    stat: "+312% shelf pickup",
  },
  {
    title: "TANGERINE BANK",
    tag: "Web + Motion",
    year: "2025",
    img: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=70",
    stat: "2.1M launch views",
  },
  {
    title: "GRUBLAB",
    tag: "Identity + Campaign",
    year: "2025",
    img: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=70",
    stat: "Cannes shortlist",
  },
  {
    title: "OFFCUT VINTAGE",
    tag: "E-commerce",
    year: "2024",
    img: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=70",
    stat: "+188% conversion",
  },
];

const PROCESS = [
  {
    step: "A",
    title: "We listen",
    text: "One brutal kickoff workshop. You talk, we interrogate. 90 minutes, no slides.",
  },
  {
    step: "B",
    title: "We fight",
    text: "Three directions, one week. We argue internally so you don't have to. The best idea wins, not the safest.",
  },
  {
    step: "C",
    title: "We build",
    text: "Design, code, motion — all in-house, all in one room. You see progress every 48 hours.",
  },
  {
    step: "D",
    title: "We ship",
    text: "On time or we tell you why two weeks early. Then we measure what happened and brag about it.",
  },
];

const FAQS = [
  {
    q: "How much does it cost?",
    a: "Identity projects start at $28k. Websites at $45k. Campaigns depend on how famous you want to be. If that made you flinch, we're probably not your studio — and that's fine.",
  },
  {
    q: "How long does it take?",
    a: "Identity: 5-7 weeks. Website: 8-12 weeks. We don't do 'quick versions'. Quick versions are how brands end up beige.",
  },
  {
    q: "Do you work with startups?",
    a: "Constantly. Half our clients are seed-to-Series-B. We take two equity-partial projects per year. Pitch us.",
  },
  {
    q: "Can we just get a logo?",
    a: "No. A logo without a system is a sticker. We do stickers too, but only as part of something bigger.",
  },
  {
    q: "Who will actually work on our project?",
    a: "The people you meet in the first call. No bait-and-switch to juniors. 14 people, zero account managers.",
  },
  {
    q: "Do you do AI-generated design?",
    a: "We use tools like everyone else. But every idea, sketch and final pixel is decided by a human with taste and a deadline.",
  },
];

const CLIENTS = [
  "MOSHPIT",
  "TANGERINE",
  "GRUBLAB",
  "OFFCUT",
  "HELVETICA GYM",
  "PLONK WINES",
  "DIALTONE",
  "KAPOW SNACKS",
  "BRUUT",
];

export default function App() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="#top">RAW★WORKS</a>
        <nav className="nav-links">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#process">Process</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="btn btn-accent" href="#contact">START A FIGHT →</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="sticker sticker-yellow">EST. 2017<br />ROTTERDAM</div>
          <div className="sticker sticker-blue">100% HUMAN<br />MADE ✷</div>
          <h1>
            WE MAKE<br />
            BRANDS YOU<br />
            CAN'T <span className="scribble">IGNORE.</span>
          </h1>
          <p className="hero-sub">
            Raw Works is a 14-person creative studio. We do branding, websites and campaigns
            for companies bored of looking like everyone else. 9 awards. 0 beige deliverables.
          </p>
          <div className="hero-cta">
            <a className="btn btn-black" href="#work">SEE THE WORK ↓</a>
            <a className="btn btn-white" href="#contact">hello@rawworks.studio</a>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
              <span key={i} className="marquee-item">
                {w} <span className="marquee-star">✦</span>
              </span>
            ))}
          </div>
        </div>

        <section className="services" id="services">
          <h2 className="section-title">
            WHAT WE DO<span className="title-dot">.</span>
          </h2>
          <div className="service-grid">
            {SERVICES.map((s) => (
              <article key={s.num} className="service-card" style={{ background: s.color }}>
                <span className="service-num">{s.num}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="service-arrow">→</span>
              </article>
            ))}
          </div>
        </section>

        <section className="work" id="work">
          <div className="work-head">
            <h2 className="section-title">
              SELECTED<br />WORK<span className="title-dot">.</span>
            </h2>
            <p className="work-note">
              37 projects shipped since 2017.<br />These four still make us grin.
            </p>
          </div>
          <div className="project-grid">
            {PROJECTS.map((p, i) => (
              <article key={p.title} className={`project ${i % 2 === 1 ? "project-offset" : ""}`}>
                <div className="project-media">
                  <img src={p.img} alt={p.title} />
                  <span className="project-stat">{p.stat}</span>
                </div>
                <div className="project-meta">
                  <h3>{p.title}</h3>
                  <div className="project-tags">
                    <span className="tag">{p.tag}</span>
                    <span className="tag tag-year">{p.year}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="shout">
          <p>
            "THEY REBRANDED US IN SIX WEEKS AND OUR SIGN-UPS <em>DOUBLED</em>.
            ALSO THEY'RE ANNOYINGLY FUN TO WORK WITH."
          </p>
          <span className="shout-credit">— Petra Molnár, CEO of Tangerine Bank</span>
          <div className="shout-awards">
            <span className="tag">AWWWARDS SOTD ×3</span>
            <span className="tag">D&AD WOOD PENCIL</span>
            <span className="tag">CANNES SHORTLIST '25</span>
            <span className="tag">FWA OF THE MONTH</span>
          </div>
        </section>

        <section className="process" id="process">
          <h2 className="section-title">
            HOW IT WORKS<span className="title-dot">.</span>
          </h2>
          <div className="process-grid">
            {PROCESS.map((p) => (
              <div key={p.step} className="process-card">
                <span className="process-step">{p.step}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
          <div className="client-strip">
            <p className="client-label">BRANDS THAT SURVIVED US:</p>
            <div className="client-tags">
              {CLIENTS.map((c) => (
                <span key={c} className="tag">{c}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <h2 className="section-title">
            REAL QUESTIONS<span className="title-dot">.</span>
          </h2>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={f.q} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {f.q}
                  <span className="faq-toggle">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <p className="faq-a">{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="contact" id="contact">
          <div className="contact-box">
            <h2>
              GOT A PROJECT?<br />
              <span className="contact-accent">LET'S RUIN BEIGE TOGETHER.</span>
            </h2>
            <p>Tell us what you're building. We reply within 24 hours, usually with opinions.</p>
            <a className="btn btn-accent btn-big" href="#top">hello@rawworks.studio</a>
            <div className="contact-facts">
              <span>⚑ Rotterdam, NL</span>
              <span>☎ +31 10 555 0192</span>
              <span>✷ 2 project slots left for Q4</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <span className="footer-brand">RAW★WORKS</span>
          <div className="footer-links">
            <a href="#work">Work</a>
            <a href="#services">Services</a>
            <a href="#top">Instagram</a>
            <a href="#top">Dribbble</a>
            <a href="#top">LinkedIn</a>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 Raw Works BV — KvK 68492017</span>
          <span>Made loudly in Rotterdam. No AI wrote this. (A human did. Angrily.)</span>
        </div>
      </footer>
    </div>
  );
}
