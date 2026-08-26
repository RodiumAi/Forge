import { useState } from "react";

const episodes = [
  { n: 1, title: "Why your side project deserves a launch day", dur: "38 min", g: "linear-gradient(135deg,#7c5cff,#4b32c3)" },
  { n: 2, title: "Debugging in production without losing sleep", dur: "52 min", g: "linear-gradient(135deg,#ff7ab8,#b83280)" },
  { n: 3, title: "The art of the tiny pull request", dur: "27 min", g: "linear-gradient(135deg,#5ccfff,#2a7fb8)" },
  { n: 4, title: "From bootcamp to burnout and back again", dur: "61 min", g: "linear-gradient(135deg,#ffb85c,#c37a1f)" },
  { n: 5, title: "Databases explained with kitchen metaphors", dur: "44 min", g: "linear-gradient(135deg,#6dd98a,#2f8a4a)" },
  { n: 6, title: "What we got wrong about remote work", dur: "35 min", g: "linear-gradient(135deg,#a08cff,#5c48c3)" },
];

const hosts = [
  { name: "Mara Delacroix", role: "Producer and host", init: "MD", g: "linear-gradient(135deg,#7c5cff,#ff7ab8)" },
  { name: "Theo Andersen", role: "Engineer and co-host", init: "TA", g: "linear-gradient(135deg,#5ccfff,#7c5cff)" },
  { name: "Iris Okafor", role: "Sound designer", init: "IO", g: "linear-gradient(135deg,#ffb85c,#ff7ab8)" },
];

function PlayButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "play playing" : "play"} onClick={onClick} aria-label="Play episode">
      {active ? "\u275A\u275A" : "\u25B6"}
    </button>
  );
}

export default function App() {
  const [playing, setPlaying] = useState<number | null>(null);

  return (
    <div className="page">
      <header className="header">
        <span className="logo">Signal&amp;Noise</span>
        <nav>
          <a href="#episodes">Episodes</a>
          <a href="#hosts">Hosts</a>
          <a href="#subscribe">Subscribe</a>
        </nav>
        <a className="btn btn-accent" href="#subscribe">Follow the show</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="chip">Season 4 now streaming</span>
          <h1>Signal&amp;Noise, a podcast about building software that people actually use</h1>
          <p className="lead">
            Two engineers and a sound designer unpack the messy, funny, human side
            of shipping code. New episode every other Tuesday.
          </p>
          <div className="hero-actions">
            <a className="btn btn-accent" href="#episodes">Start listening</a>
            <a className="btn btn-ghost" href="#hosts">Meet the crew</a>
          </div>
          <p className="stat"><strong>1,200+</strong> listeners tune in weekly</p>
        </div>
        <div className="hero-art">
          <div className="wave" />
          <span className="hero-play">&#9654;</span>
        </div>
      </section>

      <section className="episodes" id="episodes">
        <div className="section-head">
          <h2>Latest episodes</h2>
          <a href="#episodes" className="more">Browse all &rarr;</a>
        </div>
        <ol className="ep-list">
          {episodes.map((ep) => (
            <li key={ep.n} className="ep">
              <span className="ep-num">{String(ep.n).padStart(2, "0")}</span>
              <div className="ep-cover" style={{ background: ep.g }} />
              <div className="ep-info">
                <h3>{ep.title}</h3>
                <span className="dur">{ep.dur}</span>
              </div>
              <PlayButton active={playing === ep.n} onClick={() => setPlaying(playing === ep.n ? null : ep.n)} />
            </li>
          ))}
        </ol>
      </section>

      <section className="hosts" id="hosts">
        <h2>Behind the microphones</h2>
        <div className="host-grid">
          {hosts.map((h) => (
            <article key={h.init} className="host">
              <div className="avatar" style={{ background: h.g }}>{h.init}</div>
              <h3>{h.name}</h3>
              <p>{h.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="subscribe" id="subscribe">
        <h2>Never miss an episode</h2>
        <p>Drop your email, we&apos;ll ping you when a new one lands. No spam, ever.</p>
        <form onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="you@example.com" aria-label="Email" />
          <button className="btn btn-accent" type="submit">Subscribe</button>
        </form>
      </section>

      <footer className="footer">
        <span className="logo">Signal&amp;Noise</span>
        <nav>
          <a href="#episodes">Episodes</a>
          <a href="#hosts">Hosts</a>
          <a href="#subscribe">Contact</a>
        </nav>
        <p>&copy; 2026 Signal&amp;Noise. A fictional demo podcast.</p>
      </footer>
    </div>
  );
}
