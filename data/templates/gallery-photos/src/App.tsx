import { useState } from "react";

type Shot = {
  id: number;
  title: string;
  category: string;
  tall: boolean;
  gradient: string;
  src: string;
  alt: string;
};

const CATEGORIES = ["All", "Nature", "Urban", "Architecture", "Travel", "Studio"];

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

const SHOTS: Shot[] = [
  { id: 1, title: "Fog Over the Pines", category: "Nature", tall: true, gradient: "linear-gradient(160deg, #7a9471, #33402e 70%)", src: img("photo-1470071459604-3b5ec3a7fe05"), alt: "Foggy mountain ridge above a pine forest at sunrise" },
  { id: 2, title: "Crosswalk at Dusk", category: "Urban", tall: false, gradient: "linear-gradient(200deg, #d99a6c, #4a3550 80%)", src: img("photo-1449824913935-59a10b8d2000"), alt: "City street with crosswalk and tall buildings at dusk" },
  { id: 3, title: "Forest Path", category: "Nature", tall: false, gradient: "linear-gradient(180deg, #a8c3cf, #3d5a6b 75%)", src: img("photo-1441974231531-c6227db76b6e"), alt: "Sunlight streaming through a dense green forest" },
  { id: 4, title: "Concrete Curves", category: "Architecture", tall: true, gradient: "linear-gradient(145deg, #cfc8bd, #6d6459 85%)", src: img("photo-1486406146926-c627a92ad1ab"), alt: "Modern building facade with curved concrete lines" },
  { id: 5, title: "Alpine Ridge", category: "Nature", tall: false, gradient: "linear-gradient(170deg, #b7c9a1, #4f6b46 80%)", src: img("photo-1506905925346-21bda4d32df4"), alt: "Snow-capped mountain peaks under a clear sky" },
  { id: 6, title: "Neon Alley", category: "Urban", tall: true, gradient: "linear-gradient(210deg, #e0777d, #2a2140 75%)", src: img("photo-1477959858617-67f85cf4f1df"), alt: "City skyline lit up at night" },
  { id: 7, title: "Island Shore", category: "Travel", tall: false, gradient: "linear-gradient(150deg, #e8c48a, #96603a 85%)", src: img("photo-1476514525535-07fb3b4ae5f1"), alt: "Turquoise lake shore with boats seen from above" },
  { id: 8, title: "Glass Atrium", category: "Architecture", tall: false, gradient: "linear-gradient(190deg, #bcd0d8, #52616e 80%)", src: img("photo-1487958449943-2429e8be8625"), alt: "White modern building with glass panels against blue sky" },
  { id: 9, title: "Balloons at Dawn", category: "Travel", tall: false, gradient: "linear-gradient(160deg, #d9b6c4, #6e8a5e 90%)", src: img("photo-1444703686981-a3abbc4d4fe3"), alt: "Hot air balloons rising over a valley at dawn" },
  { id: 10, title: "Rooftop Lines", category: "Urban", tall: false, gradient: "linear-gradient(175deg, #9aa4b5, #2f3542 80%)", src: img("photo-1465101046530-73398c7f28ca"), alt: "Night sky over illuminated city rooftops" },
  { id: 11, title: "Desk Setup", category: "Studio", tall: true, gradient: "linear-gradient(155deg, #d8a988, #5c4436 85%)", src: img("photo-1531297484001-80022131f5a1"), alt: "Laptop on a dark desk in a moody studio" },
  { id: 12, title: "Studio Keys", category: "Studio", tall: false, gradient: "linear-gradient(165deg, #c98a6b, #7a4a3a 80%)", src: img("photo-1517694712202-14dd9538aa97"), alt: "Close-up of a laptop keyboard glowing in low light" }
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
        {visible.map((shot, i) => (
          <figure key={shot.id} className={"tile" + (shot.tall ? " tile--tall" : "")}>
            <div className="tile-photo" style={{ background: shot.gradient }}>
              <img
                src={shot.src}
                alt={shot.alt}
                loading={i === 0 ? undefined : "lazy"}
              />
            </div>
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
