import { useState } from "react";

const destinations = [
  {
    name: "Patagonia Icefield Traverse",
    place: "Chile / Argentina",
    days: "14 days",
    grade: "Demanding",
    price: "$6,400",
    img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Svalbard Polar Circuit",
    place: "Norway, 78°N",
    days: "10 days",
    grade: "Moderate",
    price: "$5,200",
    img: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Vatnajökull Ice Caves",
    place: "Iceland",
    days: "6 days",
    grade: "Accessible",
    price: "$2,900",
    img: "https://images.unsplash.com/photo-1478827536114-da961b7f86d2?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Karakoram High Camps",
    place: "Pakistan",
    days: "21 days",
    grade: "Expedition",
    price: "$9,800",
    img: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=70",
  },
];

const itinerary = [
  {
    day: "Day 1–2",
    title: "Punta Arenas — basecamp briefing",
    text: "Gear check, glacier travel refresher and a long dinner with your guide team. Weather window review every evening at 19:00.",
  },
  {
    day: "Day 3–5",
    title: "Approach through the lenga forest",
    text: "Two days of loaded hiking to the ice edge. Camp beside the moraine lake; first crampon session on dry ice.",
  },
  {
    day: "Day 6–10",
    title: "The white interior",
    text: "Five days of roped travel across the icefield. Whiteout navigation practice, crevasse rescue drills, and the silence you came for.",
  },
  {
    day: "Day 11–13",
    title: "Descent by the eastern glacier",
    text: "Down through seracs to the fjord. A chartered boat meets the team at the terminal face — the best cold beer of your life.",
  },
  {
    day: "Day 14",
    title: "Return & debrief",
    text: "Back in Punta Arenas. Route log, photo exchange, and your guide's written recommendation for your next objective.",
  },
];

const stats = [
  { value: "27", label: "years leading expeditions" },
  { value: "640+", label: "expeditions completed" },
  { value: "58", label: "summits & crossings" },
  { value: "0", label: "clients left behind. Ever." },
];

const guides = [
  {
    name: "Marta Kowalczyk",
    role: "Lead Guide — Polar",
    creds: "IFMGA · 11 Svalbard seasons · WEMT",
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Diego Ferrada",
    role: "Lead Guide — Patagonia",
    creds: "IFMGA · 40+ icefield crossings · Rescue 3",
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Anders Vik",
    role: "Expedition Director",
    creds: "27 yrs guiding · Denali, K2 BC, Antarctica",
    img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=70",
  },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="page">
      {/* ---------- Navbar ---------- */}
      <header className="nav">
        <a className="nav-logo" href="#top">
          <span className="nav-peak" aria-hidden="true">▲</span> Glacier Expeditions
        </a>
        <nav className="nav-links">
          <a href="#destinations">Destinations</a>
          <a href="#itinerary">Itinerary</a>
          <a href="#guides">Guides</a>
          <a href="#book" className="nav-book">Book a journey</a>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="hero" id="top">
        <img
          className="hero-img"
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=70"
          alt="Snowbound mountain range at dawn"
        />
        <div className="hero-veil" />
        <div className="hero-content">
          <p className="hero-kicker">Guided journeys · 78°N to 50°S</p>
          <h1 className="hero-title">
            The cold ends
            <br />
            of the earth,
            <br />
            <span>in good hands.</span>
          </h1>
          <p className="hero-sub">
            Small-team expeditions to icefields, polar coasts and high glaciers —
            led by IFMGA guides who have spent decades exactly where you want to go.
          </p>
          <div className="hero-cta">
            <a className="btn btn-solid" href="#destinations">Explore expeditions</a>
            <a className="btn btn-line" href="#itinerary">See a sample itinerary</a>
          </div>
        </div>
        <div className="hero-scroll" aria-hidden="true">▼</div>
      </section>

      {/* ---------- Destinations ---------- */}
      <section className="section" id="destinations">
        <div className="section-head">
          <p className="eyebrow">2026 – 2027 season</p>
          <h2 className="section-title">Four journeys. No shortcuts.</h2>
          <p className="section-sub">
            Every departure is capped at eight travellers and two guides. When a
            trip says demanding, believe it — and know we'll get you ready.
          </p>
        </div>
        <div className="dest-grid">
          {destinations.map((d) => (
            <article className="dest-card" key={d.name}>
              <div className="dest-imgwrap">
                <img src={d.img} alt={d.name} />
                <span className="dest-grade">{d.grade}</span>
              </div>
              <div className="dest-body">
                <h3 className="dest-name">{d.name}</h3>
                <p className="dest-place">{d.place}</p>
                <div className="dest-foot">
                  <span>{d.days}</span>
                  <span className="dest-price">from {d.price}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ---------- Itinerary timeline ---------- */}
      <section className="section" id="itinerary">
        <div className="section-head">
          <p className="eyebrow">Sample itinerary</p>
          <h2 className="section-title">Patagonia Icefield Traverse, day by day</h2>
          <p className="section-sub">
            Fourteen days from Punta Arenas and back. Weather owns the schedule;
            we build in the margin so you don't feel it.
          </p>
        </div>
        <ol className="timeline">
          {itinerary.map((step) => (
            <li className="timeline-item" key={step.day}>
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-body">
                <span className="timeline-day">{step.day}</span>
                <h3 className="timeline-title">{step.title}</h3>
                <p className="timeline-text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Guides ---------- */}
      <section className="section guides" id="guides">
        <div className="guides-band">
          <img
            src="https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=70"
            alt="Rope team crossing a glacier"
          />
          <div className="guides-band-veil" />
          <blockquote className="guides-quote">
            “A guide's job is not to make the mountain safe.
            It's to make your judgement better.”
            <cite>— Anders Vik, Expedition Director</cite>
          </blockquote>
        </div>
        <div className="section-head">
          <p className="eyebrow">The team</p>
          <h2 className="section-title">Guides you'd rope up with anywhere</h2>
        </div>
        <div className="guide-grid">
          {guides.map((g) => (
            <article className="guide-card" key={g.name}>
              <img className="guide-img" src={g.img} alt={g.name} />
              <div className="guide-body">
                <h3 className="guide-name">{g.name}</h3>
                <p className="guide-role">{g.role}</p>
                <p className="guide-creds">{g.creds}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Booking CTA ---------- */}
      <section className="book" id="book">
        <div className="book-inner">
          <h2 className="book-title">The ice doesn't wait.</h2>
          <p className="book-sub">
            Departures for the 2026–27 season open on March 1. Leave your email
            and we'll hold you a briefing call before public booking opens.
          </p>
          {sent ? (
            <p className="book-done">✓ You're on the list. Talk soon — bring questions.</p>
          ) : (
            <form
              className="book-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSent(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@basecamp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <button className="btn btn-solid" type="submit">Reserve a call</button>
            </form>
          )}
          <p className="book-note">No deposit required · Full refund 90 days out · ATOL protected</p>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="footer-cols">
          <div>
            <p className="footer-logo">▲ Glacier Expeditions</p>
            <p className="footer-small">
              Longyearbyen · Punta Arenas · Reykjavík
              <br />© 2026 Glacier Expeditions AS
            </p>
          </div>
          <div>
            <p className="footer-head">Journeys</p>
            <a href="#destinations">Patagonia</a>
            <a href="#destinations">Svalbard</a>
            <a href="#destinations">Iceland</a>
            <a href="#destinations">Karakoram</a>
          </div>
          <div>
            <p className="footer-head">Company</p>
            <a href="#guides">Guides</a>
            <a href="#top">Safety record</a>
            <a href="#top">Journal</a>
          </div>
          <div>
            <p className="footer-head">Contact</p>
            <a href="#book">hello@glacierexp.com</a>
            <a href="#book">+47 79 02 33 10</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
