import { Play } from "lucide-react";

export default function Hero() {
  return (
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
          <a className="btn btn-neon btn-lg" href="#tracks">
            <Play size={16} fill="currentColor" aria-hidden="true" />
            Play the album
          </a>
          <a className="btn btn-cyan btn-lg" href="#tour">See tour dates</a>
        </div>
      </div>
    </section>
  );
}
