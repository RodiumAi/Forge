import { MoveRight } from "lucide-react";

export default function Essay() {
  return (
    <section className="section" id="essay">
      <div className="section-rule">
        <h2 className="section-title">From the lead essay</h2>
        <span className="section-note">“The tyranny of the feed, ten years on”</span>
      </div>
      <div className="essay-grid">
        <figure className="essay-figure">
          <img
            src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=70"
            alt="Tall library shelves in black and white"
            loading="lazy"
          />
          <figcaption>The reading room, before the feed. Photograph, 2025.</figcaption>
        </figure>
        <div className="essay-text">
          <p className="dropcap">
            The feed was never designed for you. It was designed for the
            measurable version of you — the one that clicks, lingers, returns.
            Ten years ago this magazine published a skeptical essay about
            infinite scroll; we were accused of nostalgia. Today the engineers
            who built these systems say sharper things than we ever dared.
          </p>
          <p>
            What changed was not the technology but the accounting. Attention,
            it turns out, behaves like topsoil: it can be strip-mined for a
            while, and the yields even look spectacular, until suddenly nothing
            grows. Publishers noticed first. Then advertisers. Then, finally,
            the platforms themselves, staring at engagement charts that only
            went up while satisfaction charts only went down.
          </p>
          <p>
            The interesting story of 2026 is not another jeremiad against the
            feed. It is the quiet profusion of things built against it: apps
            that end, newsletters that arrive weekly on purpose, and reading
            software whose only metric is whether you finished.
          </p>
          <a className="essay-more" href="#index">
            Continue reading in the issue <MoveRight size={15} strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </section>
  );
}
