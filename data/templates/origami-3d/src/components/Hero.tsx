import { ArrowDown, Sparkle } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="hero-badge">
          <Sparkle size={12} fill="currentColor" /> Foldspace 2.0 — now with live load simulation
        </p>
        <h1 className="hero-title">
          Prototype in
          <br />
          <span className="hero-accent">three dimensions,</span>
          <br />
          think in one sheet.
        </h1>
        <p className="hero-sub">
          Foldspace is the browser-native prototyping platform where flat
          sketches become folded, fabricable parts. Design, simulate and
          ship hardware at software speed.
        </p>
        <div className="hero-cta">
          <a className="btn btn-solid btn-lg" href="#pricing">Start free — no card</a>
          <a className="btn btn-ghost btn-lg" href="#how">
            Watch it fold <ArrowDown size={15} strokeWidth={2.25} />
          </a>
        </div>
        <p className="hero-note">Trusted by teams at Framework, Prusa Labs and Ortho Robotics.</p>
      </div>
      <div className="hero-stage">
        <div className="cube-scene">
          <div className="cube">
            <div className="cube-face face-front">FOLD</div>
            <div className="cube-face face-back">SHIP</div>
            <div className="cube-face face-right">CUT</div>
            <div className="cube-face face-left">BEND</div>
            <div className="cube-face face-top"><Sparkle size={26} fill="currentColor" /></div>
            <div className="cube-face face-bottom">3D</div>
          </div>
          <div className="cube-shadow" />
        </div>
      </div>
    </section>
  );
}
