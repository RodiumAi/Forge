import { ArrowDown, Leaf } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="eyebrow">Regeneration, not just sustainability</span>
        <h1 className="h1">
          The earth doesn&apos;t need saving.<br />
          It needs <em>partners</em>.
        </h1>
        <p className="lede">
          Terra Collective connects businesses and citizens to verified regenerative
          projects — forests, soils, coasts — with radical transparency on where
          every euro lands.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-accent" href="#projects">Explore projects</a>
          <a className="btn btn-outline" href="#impact">
            See our impact <ArrowDown size={15} strokeWidth={2.5} />
          </a>
        </div>
        <div className="hero-note">
          <Leaf size={15} /> 118.4 B Corp score · audited annually
        </div>
      </div>
      <div className="hero-visual">
        <div className="blob blob-back" aria-hidden />
        <img
          className="blob-img"
          src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70"
          alt="Sunlight through a dense forest canopy"
        />
        <div className="blob-badge">Since 2019</div>
      </div>
    </section>
  );
}
