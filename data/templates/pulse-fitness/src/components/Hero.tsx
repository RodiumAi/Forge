import { MoveRight } from "lucide-react";

export default function Hero() {
  return (
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
          <a className="btn btn-lime" href="#plans">
            START 7-DAY TRIAL <MoveRight size={16} strokeWidth={2.25} />
          </a>
          <a className="btn btn-out" href="#programs">SEE PROGRAMS</a>
        </div>
      </div>
    </section>
  );
}
