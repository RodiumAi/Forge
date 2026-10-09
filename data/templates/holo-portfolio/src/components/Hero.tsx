import { ArrowDown } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <p className="hero-tag">Creative technologist — Berlin / remote</p>
      <h1 className="mega">
        I BUILD
        <br />
        <span className="mega-grad">IMPOSSIBLE</span>
        <br />
        INTERFACES
      </h1>
      <p className="hero-sub">
        Ten years turning briefs into things people screenshot. WebGL experiences, live visuals,
        and brands that refuse to sit still.
      </p>
      <div className="hero-meta">
        <span className="pill">Available Q3 2026</span>
        <span className="pill pill-ghost">4 awards · 40+ shipped projects</span>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <strong>10y</strong>
          <span>in the field</span>
        </div>
        <div className="hero-stat">
          <strong>40+</strong>
          <span>projects shipped</span>
        </div>
        <div className="hero-stat">
          <strong>60fps</strong>
          <span>or it doesn't ship</span>
        </div>
      </div>
      <a href="#work" className="scroll-cue" aria-label="Scroll to work">
        <ArrowDown strokeWidth={1.5} aria-hidden="true" />
      </a>
    </section>
  );
}
