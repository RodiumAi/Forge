import { Triangle } from "lucide-react";

export default function Hero() {
  return (
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
      <div className="hero-scroll" aria-hidden="true">
        <Triangle size={13} fill="currentColor" />
      </div>
    </section>
  );
}
