import { useState } from "react";

const treatments = [
  {
    emoji: "🌸",
    name: "Petal Glow Facial",
    desc: "Rose-quartz massage and botanical peel that leaves skin luminous and calm.",
    duration: "60 min",
    price: "$120",
  },
  {
    emoji: "🌿",
    name: "Sage Deep Release",
    desc: "Slow, deep-tissue work with warm sage oil for shoulders, back and neck.",
    duration: "75 min",
    price: "$145",
  },
  {
    emoji: "💧",
    name: "Still Water Soak",
    desc: "Private mineral bath with magnesium salts, followed by warm-towel wrapping.",
    duration: "45 min",
    price: "$85",
  },
  {
    emoji: "🕯️",
    name: "Candlelight Ritual",
    desc: "Full-body warm candle-oil massage in our quietest room, lit only by flame.",
    duration: "90 min",
    price: "$180",
  },
  {
    emoji: "🍃",
    name: "Forest Breath",
    desc: "Guided breathwork and lymphatic facial massage with cedar and pine essences.",
    duration: "50 min",
    price: "$95",
  },
  {
    emoji: "🌙",
    name: "Moonrise Duo",
    desc: "Side-by-side evening massage for two, with herbal tea service after.",
    duration: "80 min",
    price: "$260",
  },
];

const schedule = [
  { day: "Monday", cls: "Sunrise Yin Yoga", time: "7:30 – 8:30", coach: "Amara" },
  { day: "Tuesday", cls: "Breath & Sound Bath", time: "18:00 – 19:00", coach: "Theo" },
  { day: "Wednesday", cls: "Slow Flow Pilates", time: "9:00 – 10:00", coach: "June" },
  { day: "Thursday", cls: "Candlelit Stretch", time: "19:30 – 20:30", coach: "Amara" },
  { day: "Friday", cls: "Meditation Circle", time: "8:00 – 8:45", coach: "Theo" },
  { day: "Saturday", cls: "Restorative Yoga", time: "10:00 – 11:15", coach: "June" },
];

const ritual = [
  { step: "01", title: "Arrive & Unwind", text: "Trade the outside world for a robe, warm slippers and our signature hibiscus tea." },
  { step: "02", title: "Warm Preparation", text: "Ten minutes in the eucalyptus steam room prepares muscles and quiets the mind." },
  { step: "03", title: "Your Treatment", text: "Your therapist tailors pressure, oils and pace to exactly how you feel today." },
  { step: "04", title: "The Slow Return", text: "Rest in the daybed lounge as long as you like. There is no clock in that room." },
];

const testimonials = [
  {
    quote: "I walked in carrying a whole week of stress. Ninety minutes later I felt like I had slept for two days.",
    name: "Claire M.",
    detail: "Candlelight Ritual guest",
  },
  {
    quote: "Bloom is the only place where my phone stays in the locker and I don't even miss it.",
    name: "Priya S.",
    detail: "Member since 2024",
  },
  {
    quote: "The therapists actually listen. Every visit feels designed for that day, not from a script.",
    name: "Daniel R.",
    detail: "Sage Deep Release regular",
  },
];

const memberships = [
  { name: "Seedling", price: "$79/mo", perks: ["1 treatment each month", "Unlimited steam room", "10% off retail"] },
  { name: "Garden", price: "$139/mo", perks: ["2 treatments each month", "2 guest passes yearly", "Priority booking"] },
  { name: "Meadow", price: "$219/mo", perks: ["Weekly classes included", "3 treatments each month", "Private locker & robe"] },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="page">
      {/* Navbar */}
      <header className="nav-wrap">
        <nav className="nav">
          <a className="logo" href="#top">
            <span className="logo-dot">✿</span> Bloom Studio
          </a>
          <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
          <div className={`nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#treatments">Treatments</a>
            <a href="#schedule">Classes</a>
            <a href="#ritual">The Ritual</a>
            <a href="#stories">Stories</a>
            <a href="#visit" className="nav-cta">Book a visit</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero" id="top">
        <div className="hero-text">
          <p className="eyebrow">Spa · Yoga · Quiet</p>
          <h1>
            Come back to <em>yourself</em>, one soft hour at a time
          </h1>
          <p className="hero-sub">
            Bloom Studio is a small sanctuary of steam, warm oil and unhurried hands.
            No queues, no noise — just rooms that smell like sage and time that belongs to you.
          </p>
          <div className="hero-actions">
            <a href="#visit" className="btn-main">Book your ritual</a>
            <a href="#treatments" className="btn-soft">See treatments</a>
          </div>
          <div className="hero-badges">
            <span>🌿 Organic oils only</span>
            <span>🤍 4.9 from 800+ guests</span>
          </div>
        </div>
        <div className="hero-media">
          <img
            src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=70"
            alt="Spa stones and folded towels"
          />
          <div className="hero-chip">Open today · 9:00 – 21:00</div>
        </div>
      </section>

      {/* Treatments */}
      <section className="treatments" id="treatments">
        <div className="sec-head">
          <p className="eyebrow">The Menu</p>
          <h2>Treatments, priced gently</h2>
          <p className="sec-sub">Every session includes steam-room access and unlimited daybed time after.</p>
        </div>
        <div className="treat-grid">
          {treatments.map((t) => (
            <article className="treat-card" key={t.name}>
              <span className="treat-emoji">{t.emoji}</span>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <div className="treat-meta">
                <span className="treat-time">{t.duration}</span>
                <span className="treat-price">{t.price}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Schedule */}
      <section className="schedule" id="schedule">
        <div className="sec-head">
          <p className="eyebrow">Weekly Classes</p>
          <h2>The studio calendar</h2>
        </div>
        <div className="sched-tabs">
          {schedule.map((s, i) => (
            <button
              key={s.day}
              className={`sched-tab ${i === activeDay ? "active" : ""}`}
              onClick={() => setActiveDay(i)}
            >
              {s.day.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="sched-card">
          <div className="sched-day">{schedule[activeDay].day}</div>
          <h3>{schedule[activeDay].cls}</h3>
          <p className="sched-time">🕊️ {schedule[activeDay].time}</p>
          <p className="sched-coach">with {schedule[activeDay].coach} · mats & blankets provided</p>
          <a href="#visit" className="btn-soft">Reserve a spot</a>
        </div>
      </section>

      {/* Ritual steps */}
      <section className="ritual" id="ritual">
        <div className="ritual-media">
          <img
            src="https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=70"
            alt="Calm spa interior"
            loading="lazy"
          />
          <img
            className="ritual-media-small"
            src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=70"
            alt="Facial treatment"
            loading="lazy"
          />
        </div>
        <div className="ritual-copy">
          <p className="eyebrow">How a visit unfolds</p>
          <h2>The Bloom ritual, in four breaths</h2>
          <ol className="steps">
            {ritual.map((r) => (
              <li key={r.step}>
                <span className="step-num">{r.step}</span>
                <div>
                  <h3>{r.title}</h3>
                  <p>{r.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      <section className="stories" id="stories">
        <div className="sec-head">
          <p className="eyebrow">Guest stories</p>
          <h2>Quiet words from quiet people</h2>
        </div>
        <div className="story-grid">
          {testimonials.map((t) => (
            <blockquote className="story" key={t.name}>
              <p>“{t.quote}”</p>
              <footer>
                <strong>{t.name}</strong>
                <span>{t.detail}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Memberships */}
      <section className="plans">
        <div className="sec-head">
          <p className="eyebrow">Memberships</p>
          <h2>Make calm a habit</h2>
          <p className="sec-sub">Pause or cancel anytime — wellness should never feel like a contract.</p>
        </div>
        <div className="plan-grid">
          {memberships.map((m, i) => (
            <article className={`plan ${i === 1 ? "plan-featured" : ""}`} key={m.name}>
              {i === 1 && <span className="plan-badge">Most loved</span>}
              <h3>{m.name}</h3>
              <p className="plan-price">{m.price}</p>
              <ul>
                {m.perks.map((p) => (
                  <li key={p}>🌿 {p}</li>
                ))}
              </ul>
              <a href="#visit" className={i === 1 ? "btn-main" : "btn-soft"}>Choose {m.name}</a>
            </article>
          ))}
        </div>
      </section>

      {/* Visit CTA */}
      <section className="visit" id="visit">
        <div className="visit-inner">
          <img
            src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=70"
            alt="Spa pool"
            loading="lazy"
          />
          <div className="visit-copy">
            <h2>Your first hour of quiet is waiting</h2>
            <p>
              New guests receive a complimentary steam session and herbal tea with any treatment.
              We recommend booking two days ahead — the calendar fills softly but surely.
            </p>
            <a href="#top" className="btn-main">Book your visit</a>
            <p className="visit-note">14 Willow Lane · Tue–Sun 9:00–21:00 · hello@bloomstudio.co</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="logo-dot">✿</span> Bloom Studio
            <p>A small sanctuary for slow hours.</p>
          </div>
          <div className="footer-links">
            <a href="#treatments">Treatments</a>
            <a href="#schedule">Classes</a>
            <a href="#ritual">The Ritual</a>
            <a href="#visit">Book</a>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 Bloom Studio</span>
          <span>Made with warm towels and patience</span>
        </div>
      </footer>
    </div>
  );
}
