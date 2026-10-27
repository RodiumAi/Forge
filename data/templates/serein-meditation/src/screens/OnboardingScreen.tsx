import "../styles/onboarding.css";
import { ArrowRight, Moon, Sunrise } from "lucide-react";
import { useState } from "react";
import BreathOrb from "../components/BreathOrb";
import { CATEGORIES, SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><i aria-hidden /> Serein</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <BreathOrb />
        <figure className="float a">
          <img src={CATEGORIES[3].photo} alt="" />
          <figcaption><Sunrise size={13} strokeWidth={2} /> Morning, 7 min</figcaption>
        </figure>
        <figure className="float b">
          <img src={CATEGORIES[0].photo} alt="" />
          <figcaption><Moon size={13} strokeWidth={2} /> Sleep, 20 min</figcaption>
        </figure>
      </div>

      <div className="onboard-body">
        <p className="kicker">{s.kicker}</p>
        <h2>{s.title} <em>{s.em}</em></h2>
        <p className="muted">{s.body}</p>
      </div>

      <div className="onboard-actions">
        <div className="dots" aria-hidden>
          {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
        </div>
        <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
          {last ? "Take my first breath" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
