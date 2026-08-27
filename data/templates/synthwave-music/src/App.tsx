import { useState } from "react";

const ALBUMS = [
  {
    title: "Midnight Arcade",
    year: "2026",
    type: "LP · 11 tracks",
    img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=70",
    note: "The new album. 43 minutes of chrome and heartbreak.",
  },
  {
    title: "Ghost Highway",
    year: "2024",
    type: "LP · 9 tracks",
    img: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=70",
    note: "12M streams. Featured in the series 'Palm Static'.",
  },
  {
    title: "VHS Dreams",
    year: "2022",
    type: "EP · 5 tracks",
    img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=70",
    note: "The one that started everything. Remastered 2025.",
  },
];

const TRACKS = [
  { n: "01", title: "Neon Rain", time: "4:12", plays: "2.4M" },
  { n: "02", title: "Chrome Hearts", time: "3:48", plays: "1.9M" },
  { n: "03", title: "Midnight Arcade", time: "5:02", plays: "3.1M" },
  { n: "04", title: "Digital Sunset (feat. LUX-88)", time: "4:31", plays: "1.6M" },
  { n: "05", title: "Last Exit to 1986", time: "3:57", plays: "1.2M" },
  { n: "06", title: "Static Love", time: "4:44", plays: "980K" },
  { n: "07", title: "Polaroid Skies", time: "3:36", plays: "870K" },
  { n: "08", title: "Runaway Signal", time: "4:19", plays: "790K" },
];

const TOUR = [
  {
    date: "OCT 09",
    city: "Berlin, DE",
    venue: "Kraftwerk Halle",
    status: "Tickets",
  },
  {
    date: "OCT 14",
    city: "Amsterdam, NL",
    venue: "Paradiso",
    status: "Tickets",
  },
  {
    date: "OCT 18",
    city: "Paris, FR",
    venue: "La Machine du Moulin Rouge",
    status: "Sold out",
  },
  {
    date: "OCT 23",
    city: "London, UK",
    venue: "Electric Brixton",
    status: "Tickets",
  },
  {
    date: "NOV 02",
    city: "New York, US",
    venue: "Brooklyn Steel",
    status: "Tickets",
  },
  {
    date: "NOV 07",
    city: "Los Angeles, US",
    venue: "The Fonda Theatre",
    status: "Low stock",
  },
];

const GEAR = [
  { name: "Roland Juno-106", role: "pads & everything warm" },
  { name: "Yamaha DX7", role: "glassy keys, obviously" },
  { name: "LinnDrum LM-2", role: "the heartbeat" },
  { name: "Tascam 388 tape", role: "where the magic dies and comes back better" },
];

const PRESS = [
  {
    quote: "The most vivid synthwave record since the genre found its name.",
    source: "Waveform Magazine",
  },
  {
    quote: "Neon Nights doesn't imitate the 80s — it transmits from them.",
    source: "Retro Circuit",
  },
  {
    quote: "A masterclass in analog warmth and digital longing.",
    source: "The Midnight Post",
  },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="#top">NEON<span className="brand-alt">NIGHTS</span></a>
        <nav className="nav-links">
          <a href="#music">Music</a>
          <a href="#tracks">Tracklist</a>
          <a href="#tour">Tour</a>
          <a href="#about">About</a>
        </nav>
        <a className="btn btn-neon" href="#music">▶ Listen now</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="sky" aria-hidden="true">
            <div className="stars" />
            <div className="sun" />
            <div className="mountains" />
          </div>
          <div className="floor" aria-hidden="true">
            <div className="grid-plane" />
          </div>
          <div className="hero-content">
            <p className="hero-eyebrow">NEW ALBUM · OUT NOW</p>
            <h1 className="glitch">MIDNIGHT<br />ARCADE</h1>
            <p className="hero-sub">
              Synthwave from the year that never was. 11 tracks of chrome, rain and slow-motion
              heartbreak — mixed on real 1984 hardware.
            </p>
            <div className="hero-cta">
              <a className="btn btn-neon btn-lg" href="#tracks">▶ Play the album</a>
              <a className="btn btn-cyan btn-lg" href="#tour">See tour dates</a>
            </div>
          </div>
        </section>

        <section className="press">
          {PRESS.map((p) => (
            <blockquote key={p.source} className="press-quote">
              “{p.quote}”
              <cite>— {p.source}</cite>
            </blockquote>
          ))}
        </section>

        <section className="albums" id="music">
          <h2 className="section-title">
            <span className="title-line" />DISCOGRAPHY<span className="title-line" />
          </h2>
          <div className="album-grid">
            {ALBUMS.map((a) => (
              <article key={a.title} className="album">
                <div className="album-stack">
                  <div className="vinyl" aria-hidden="true">
                    <div className="vinyl-label" />
                  </div>
                  <div className="album-cover">
                    <img src={a.img} alt={a.title} />
                    <span className="album-year">{a.year}</span>
                  </div>
                </div>
                <h3>{a.title}</h3>
                <p className="album-type">{a.type}</p>
                <p className="album-note">{a.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="tracklist" id="tracks">
          <div className="tracklist-inner">
            <div className="tracklist-head">
              <h2 className="section-title-left">MIDNIGHT ARCADE — TRACKLIST</h2>
              <p>Streaming everywhere. Vinyl and cassette in the shop.</p>
            </div>
            <ol className="tracks">
              {TRACKS.map((t) => (
                <li key={t.n} className="track">
                  <span className="track-n">{t.n}</span>
                  <span className="track-play">▶</span>
                  <span className="track-title">{t.title}</span>
                  <span className="track-eq" aria-hidden="true">
                    <i /><i /><i /><i />
                  </span>
                  <span className="track-plays">{t.plays}</span>
                  <span className="track-time">{t.time}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="live" id="tour">
          <div className="live-media">
            <img
              src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=70"
              alt="Neon Nights live"
            />
            <div className="live-overlay" />
            <div className="live-caption">
              <h2>THE ARCADE TOUR '26</h2>
              <p>Full analog rig · laser wall · 6 cities</p>
            </div>
          </div>
          <ul className="tour-list">
            {TOUR.map((t) => (
              <li key={t.city} className="tour-row">
                <span className="tour-date">{t.date}</span>
                <span className="tour-city">
                  <strong>{t.city}</strong>
                  <small>{t.venue}</small>
                </span>
                <a
                  className={`btn btn-sm ${t.status === "Sold out" ? "btn-dead" : "btn-neon"}`}
                  href="#tour"
                >
                  {t.status}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="about" id="about">
          <div className="about-card">
            <h2 className="section-title-left">FROM THE YEAR THAT NEVER WAS</h2>
            <p>
              Neon Nights is the solo project of producer Elena Voss. Raised on VHS tapes and
              arcade carpets, she builds every track on a wall of vintage synths — Juno-106,
              DX7, LinnDrum — recorded to tape before it ever touches a computer.
            </p>
            <p>
              Since 2022: 40M+ streams, two sold-out European tours, and placements in three
              films nobody will admit they cried during.
            </p>
            <div className="about-stats">
              <div><strong>40M+</strong><span>streams</span></div>
              <div><strong>3</strong><span>records</span></div>
              <div><strong>62</strong><span>shows played</span></div>
              <div><strong>1984</strong><span>spiritual home</span></div>
            </div>
            <div className="gear">
              <h3 className="gear-title">THE WALL OF SYNTHS</h3>
              <ul className="gear-list">
                {GEAR.map((g) => (
                  <li key={g.name}>
                    <strong>{g.name}</strong> — {g.role}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="signup">
          <h2>JOIN THE NIGHT SHIFT</h2>
          <p>Unreleased demos, presale codes and tape drops. One email a month, zero spam.</p>
          {subscribed ? (
            <p className="signup-done">✦ You're in. Check your inbox after dark.</p>
          ) : (
            <form
              className="signup-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSubscribed(true);
              }}
            >
              <input
                type="email"
                placeholder="you@midnight.fm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn btn-neon" type="submit">Subscribe</button>
            </form>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="brand">NEON<span className="brand-alt">NIGHTS</span></span>
          <div className="footer-links">
            <a href="#music">Spotify</a>
            <a href="#music">Apple Music</a>
            <a href="#music">Bandcamp</a>
            <a href="#top">YouTube</a>
            <a href="#top">Instagram</a>
          </div>
        </div>
        <p className="footer-base">
          © 2026 Neon Nights / Voss Records. Booking: agency@vossrecords.fm · Press: press@vossrecords.fm
        </p>
      </footer>
    </div>
  );
}
