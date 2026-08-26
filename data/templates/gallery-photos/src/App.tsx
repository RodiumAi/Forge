import { useState } from "react";

type Shot = {
  id: number;
  title: string;
  category: string;
  tall: boolean;
  gradient: string;
};

const CATEGORIES = ["All", "Nature", "Urban", "Travel", "Architecture"];

const SHOTS: Shot[] = [
  { id: 1, title: "Fog Over the Pines", category: "Nature", tall: true, gradient: "linear-gradient(160deg, #7a9471, #33402e 70%)" },
  { id: 2, title: "Crosswalk at Dusk", category: "Urban", tall: false, gradient: "linear-gradient(200deg, #d99a6c, #4a3550 80%)" },
  { id: 3, title: "Harbor Morning", category: "Travel", tall: false, gradient: "linear-gradient(180deg, #a8c3cf, #3d5a6b 75%)" },
  { id: 4, title: "Concrete Curves", category: "Architecture", tall: true, gradient: "linear-gradient(145deg, #cfc8bd, #6d6459 85%)" },
  { id: 5, title: "River Bend", category: "Nature", tall: false, gradient: "linear-gradient(170deg, #b7c9a1, #4f6b46 80%)" },
  { id: 6, title: "Neon Alley", category: "Urban", tall: true, gradient: "linear-gradient(210deg, #e0777d, #2a2140 75%)" },
  { id: 7, title: "Dune Road", category: "Travel", tall: false, gradient: "linear-gradient(150deg, #e8c48a, #96603a 85%)" },
  { id: 8, title: "Glass Atrium", category: "Architecture", tall: false, gradient: "linear-gradient(190deg, #bcd0d8, #52616e 80%)" },
  { id: 9, title: "Wildflower Field", category: "Nature", tall: false, gradient: "linear-gradient(160deg, #d9b6c4, #6e8a5e 90%)" },
  { id: 10, title: "Rooftop Lines", category: "Urban", tall: false, gradient: "linear-gradient(175deg, #9aa4b5, #2f3542 80%)" },
  { id: 11, title: "Old Town Steps", category: "Travel", tall: true, gradient: "linear-gradient(155deg, #d8a988, #5c4436 85%)" },
  { id: 12, title: "Brick and Sky", category: "Architecture", tall: false, gradient: "linear-gradient(165deg, #c98a6b, #7a4a3a 80%)" }
];

export default function App() {
  const [active, setActive] = useState("All");
  const visible = active === "All" ? SHOTS : SHOTS.filter((s) => s.category === active);

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">Aperture Field</span>
        <nav className="nav">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={"nav-link" + (active === c ? " nav-link--on" : "")}
              onClick={() => setActive(c)}
            >
              {c}
            </button>
          ))}
        </nav>
      </header>

      <section className="intro">
        <p className="kicker">A visual field journal</p>
        <h1>Quiet frames from loud places</h1>
        <p className="lede">
          Twelve seasons of walking with a camera — forests, side streets, ferry
          decks and stairwells, gathered into one slow-scrolling wall.
        </p>
      </section>

      <section className="filters" aria-label="Category filters">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={"chip" + (active === c ? " chip--on" : "")}
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </section>

      <main className="grid">
        {visible.map((shot) => (
          <figure key={shot.id} className={"tile" + (shot.tall ? " tile--tall" : "")}>
            <div className="tile-photo" style={{ background: shot.gradient }} />
            <figcaption className="tile-caption">
              <span className="tile-title">{shot.title}</span>
              <span className="tile-cat">{shot.category}</span>
            </figcaption>
          </figure>
        ))}
      </main>

      <section className="cta">
        <h2>Every walk leaves a frame behind</h2>
        <p>Portrait sessions, print editions and city commissions are open for the season.</p>
        <a className="cta-btn" href="#top">Browse the full wall</a>
      </section>

      <footer className="footer">
        <span>Aperture Field Studio — a fictional photography collective.</span>
        <div className="footer-links">
          <a href="#top">Journal</a>
          <a href="#top">Prints</a>
          <a href="#top">Contact</a>
        </div>
      </footer>
    </div>
  );
}
