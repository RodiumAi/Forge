import { useState } from "react";

const NAV = ["Program", "Speakers", "Venue", "Tickets"];

const MARQUEE_TOP = ["DESIGN", "CODE", "MOTION", "SYSTEMS", "TYPE", "AI"];
const MARQUEE_BOTTOM = ["BERLIN", "MAY 14–16", "2027", "3 STAGES", "48 TALKS", "LIVE"];

const STATS = [
  { n: "48", label: "Talks & workshops" },
  { n: "2,400", label: "Attendees" },
  { n: "3", label: "Stages" },
  { n: "32", label: "Countries represented" },
];

const SCHEDULE = [
  {
    day: "Day 01 — Wed May 14",
    theme: "Systems & Craft",
    items: [
      { time: "09:30", title: "Opening keynote: Interfaces after the screen", who: "Mara Voss — Head of Design, Fieldwork" },
      { time: "11:00", title: "Design tokens at planetary scale", who: "Jonas Reike — Staff Engineer, Klarna" },
      { time: "14:00", title: "Workshop: Variable fonts in production", who: "Studio Grotesque" },
      { time: "16:30", title: "The death and rebirth of the design system", who: "Amara Diallo — Principal Designer, Linear" },
    ],
  },
  {
    day: "Day 02 — Thu May 15",
    theme: "Motion & Machines",
    items: [
      { time: "09:30", title: "Choreographing UI: motion as language", who: "Kenji Nakamura — Motion Lead, Vercel" },
      { time: "11:00", title: "Shipping ML features without shipping regret", who: "Priya Sharma — AI Product, Figma" },
      { time: "14:00", title: "Workshop: WebGPU for interface designers", who: "Halide Collective" },
      { time: "16:30", title: "Panel: Who owns taste in the age of generation?", who: "Voss · Nakamura · Okafor" },
    ],
  },
  {
    day: "Day 03 — Fri May 16",
    theme: "Futures",
    items: [
      { time: "09:30", title: "Brutal honesty: a decade of shipping wrong things", who: "Tomas Okafor — Founder, Northbeam" },
      { time: "11:00", title: "Accessibility is a performance budget", who: "Lena Fischer — Web Platform, Mozilla" },
      { time: "14:00", title: "Lightning talks: 8 ideas × 8 minutes", who: "Community stage" },
      { time: "16:30", title: "Closing keynote: Make it weird again", who: "Ines Beckert — Creative Director, Studio Dumbar" },
    ],
  },
];

const SPEAKERS = [
  { name: "Mara Voss", role: "Head of Design, Fieldwork", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=70" },
  { name: "Kenji Nakamura", role: "Motion Lead, Vercel", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70" },
  { name: "Amara Diallo", role: "Principal Designer, Linear", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70" },
  { name: "Tomas Okafor", role: "Founder, Northbeam", img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70" },
  { name: "Priya Sharma", role: "AI Product, Figma", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=70" },
  { name: "Ines Beckert", role: "Creative Director, Studio Dumbar", img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=70" },
];

const TICKETS = [
  {
    name: "Standard",
    price: "€349",
    color: "blue",
    perks: ["All 3 days, all stages", "Conference kit & swag", "Lunch + coffee included", "Talk recordings"],
  },
  {
    name: "Pro",
    price: "€549",
    color: "accent",
    featured: true,
    perks: ["Everything in Standard", "1 hands-on workshop", "Speaker dinner invite", "Front-row seating", "Kinetic type specimen book"],
  },
  {
    name: "Studio ×5",
    price: "€1,990",
    color: "green",
    perks: ["5 Pro passes", "Team photo on stage 3", "Logo on the studio wall", "Priority workshop booking"],
  },
];

function Marquee({ words, reverse, outlineFirst }: { words: string[]; reverse?: boolean; outlineFirst?: boolean }) {
  const row = [...words, ...words, ...words];
  return (
    <div className="marquee">
      <div className={reverse ? "marquee-track reverse" : "marquee-track"}>
        {row.map((w, i) => (
          <span key={i} className={(i % 2 === 0) === !!outlineFirst ? "mq-word outline" : "mq-word"}>
            {w}
            <span className="mq-dot" aria-hidden>✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [openDay, setOpenDay] = useState(0);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="topbar">
        <a className="brand" href="#top">
          KINETIC<span className="brand-year">27</span>
        </a>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
          ))}
        </nav>
        <a className="btn btn-fg" href="#tickets">Get tickets →</a>
      </header>

      {/* ── Hero: opposing kinetic marquees ── */}
      <section className="hero" id="top">
        <div className="hero-meta">
          <span className="tag tag-accent">Berlin · Funkhaus</span>
          <span className="tag tag-blue">May 14–16, 2027</span>
          <span className="tag tag-green">3 stages</span>
        </div>
        <Marquee words={MARQUEE_TOP} outlineFirst />
        <Marquee words={MARQUEE_BOTTOM} reverse />
        <div className="hero-bottom">
          <p className="hero-lede">
            The conference where design and engineering stop pretending to be different
            disciplines. Three days of talks, workshops and arguments about craft —
            in a former East-Berlin radio complex.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-accent" href="#tickets">Get your pass</a>
            <a className="btn btn-ghost" href="#program">See the program ↓</a>
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="stats">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-n">{s.n}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Program (accordion) ── */}
      <section className="section" id="program">
        <div className="section-head">
          <h2 className="h2"><span className="outline-text">The</span> Program</h2>
          <p className="section-sub">Three days, three themes. Every talk is 30 minutes — no filler, no sponsors on stage.</p>
        </div>
        <div className="accordion">
          {SCHEDULE.map((d, i) => (
            <div className={openDay === i ? "acc-item open" : "acc-item"} key={d.day}>
              <button className="acc-head" onClick={() => setOpenDay(openDay === i ? -1 : i)}>
                <span className="acc-day">{d.day}</span>
                <span className="acc-theme">{d.theme}</span>
                <span className="acc-icon" aria-hidden>{openDay === i ? "−" : "+"}</span>
              </button>
              {openDay === i && (
                <ul className="acc-body">
                  {d.items.map((it) => (
                    <li className="acc-row" key={it.title}>
                      <span className="acc-time">{it.time}</span>
                      <span className="acc-title">{it.title}</span>
                      <span className="acc-who">{it.who}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Blue block: manifesto ── */}
      <section className="block block-blue">
        <h2 className="block-title">No panels about panels.<br />No “future of work”.<br />Just the work.</h2>
        <p className="block-sub">Every speaker ships. Every workshop ends with something running. That is the whole editorial policy.</p>
      </section>

      {/* ── Speakers (duotone grid) ── */}
      <section className="section" id="speakers">
        <div className="section-head">
          <h2 className="h2">Speakers <span className="outline-text">’27</span></h2>
          <p className="section-sub">First six confirmed. Twelve more announced in waves — follow the newsletter below.</p>
        </div>
        <div className="speaker-grid">
          {SPEAKERS.map((s) => (
            <article className="speaker" key={s.name}>
              <div className="speaker-photo">
                <img src={s.img} alt={s.name} loading="lazy" />
              </div>
              <h3 className="speaker-name">{s.name}</h3>
              <p className="speaker-role">{s.role}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Green block: venue ── */}
      <section className="block block-green" id="venue">
        <div className="venue-grid">
          <div>
            <h2 className="block-title dark">Funkhaus, Berlin</h2>
            <p className="venue-copy">
              A 1950s broadcast complex on the Spree with the best acoustics in Europe.
              Stage 1 is the old recording hall; the workshop floor is the former tape archive.
              Ten minutes from Ostkreuz, five from the river.
            </p>
            <ul className="venue-list">
              <li>→ Nalepastraße 18, 12459 Berlin</li>
              <li>→ Doors 08:30 · talks 09:30–18:00</li>
              <li>→ Afterparty Friday, main hall, 21:00</li>
            </ul>
          </div>
          <div className="venue-photo">
            <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=70" alt="Conference hall crowd" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── Tickets ── */}
      <section className="section" id="tickets">
        <div className="section-head">
          <h2 className="h2"><span className="outline-text">Get</span> In</h2>
          <p className="section-sub">Early-bird pricing until January 31. Students: 50% off with a valid ID, any tier.</p>
        </div>
        <div className="ticket-grid">
          {TICKETS.map((t) => (
            <article className={t.featured ? "ticket featured" : "ticket"} key={t.name} data-color={t.color}>
              {t.featured && <span className="ticket-flag">Most popular</span>}
              <h3 className="ticket-name">{t.name}</h3>
              <div className="ticket-price">{t.price}</div>
              <ul className="ticket-perks">
                {t.perks.map((p) => (
                  <li key={p}>✳ {p}</li>
                ))}
              </ul>
              <a className="btn btn-fg wide" href="#top">Buy {t.name} →</a>
            </article>
          ))}
        </div>
      </section>

      {/* ── Newsletter / CTA band ── */}
      <section className="block block-accent">
        <h2 className="block-title">Speaker waves drop by email first.</h2>
        {sent ? (
          <p className="news-done">✓ You are on the list. See you in Berlin.</p>
        ) : (
          <form
            className="news-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setSent(true);
            }}
          >
            <input
              className="news-input"
              type="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn btn-fg" type="submit">Subscribe</button>
          </form>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">KINETIC<span className="brand-year">27</span></div>
          <div className="footer-cols">
            <div>
              <h4>Event</h4>
              <a href="#program">Program</a>
              <a href="#speakers">Speakers</a>
              <a href="#tickets">Tickets</a>
            </div>
            <div>
              <h4>Info</h4>
              <a href="#venue">Venue & access</a>
              <a href="#top">Code of conduct</a>
              <a href="#top">Press kit</a>
            </div>
            <div>
              <h4>Social</h4>
              <a href="#top">Mastodon</a>
              <a href="#top">Instagram</a>
              <a href="#top">YouTube</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2027 Kinetic Conference GmbH — Berlin</span>
          <span>Designed loud, on purpose.</span>
        </div>
      </footer>
    </div>
  );
}
