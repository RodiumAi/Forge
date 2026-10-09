import { Asterisk, MoveDown } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero">
      <div className="sticker sticker-yellow">EST. 2017<br />ROTTERDAM</div>
      <div className="sticker sticker-blue">
        100% HUMAN<br />MADE <Asterisk className="sticker-icon" size={13} strokeWidth={3.5} aria-hidden="true" />
      </div>
      <h1>
        WE MAKE<br />
        BRANDS YOU<br />
        CAN'T <span className="scribble">IGNORE.</span>
      </h1>
      <p className="hero-sub">
        Raw Works is a 14-person creative studio. We do branding, websites and campaigns
        for companies bored of looking like everyone else. 9 awards. 0 beige deliverables.
      </p>
      <div className="hero-cta">
        <a className="btn btn-black" href="#work">
          SEE THE WORK <MoveDown className="btn-icon btn-icon-down" size={12} strokeWidth={3} aria-hidden="true" />
        </a>
        <a className="btn btn-white" href="#contact">hello@rawworks.studio</a>
      </div>
    </section>
  );
}
