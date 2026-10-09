import { MoveRight } from "lucide-react";

export default function Hero() {
  return (
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
          Selected work <span className="arrow"><MoveRight size={12} strokeWidth={1.75} /></span>
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
  );
}
