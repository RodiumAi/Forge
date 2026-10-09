import { MoveDown } from "lucide-react";
import Marquee from "./Marquee";

const MARQUEE_TOP = ["DESIGN", "CODE", "MOTION", "SYSTEMS", "TYPE", "AI"];
const MARQUEE_BOTTOM = ["BERLIN", "MAY 14–16", "2027", "3 STAGES", "48 TALKS", "LIVE"];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-meta">
        <span className="tag tag-accent">Berlin · Funkhaus</span>
        <span className="tag tag-blue">May 14–16, 2027</span>
        <span className="tag tag-green">3 stages</span>
      </div>
      <Marquee words={MARQUEE_TOP} outlineFirst />
      <Marquee words={MARQUEE_BOTTOM} reverse />
      <div className="hero-bottom">
        <p className="hero-lede">
          The conference where design and engineering stop pretending to be different
          disciplines. Three days of talks, workshops and arguments about craft —
          in a former East-Berlin radio complex.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-accent" href="#tickets">Get your pass</a>
          <a className="btn btn-ghost" href="#program">
            See the program <MoveDown className="btn-icon btn-icon-down" size={13} strokeWidth={2.5} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
