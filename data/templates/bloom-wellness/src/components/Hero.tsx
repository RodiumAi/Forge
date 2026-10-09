import { Heart, Leaf } from "lucide-react";

export default function Hero() {
  return (
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
          <span><Leaf className="icon-leaf" size={14} aria-hidden="true" /> Organic oils only</span>
          <span><Heart className="icon-heart" size={14} aria-hidden="true" /> 4.9 from 800+ guests</span>
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
  );
}
