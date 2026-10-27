import "../styles/onboarding.css";
import { ArrowRight, Lamp, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { ONBOARD_PHOTO, SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <img className="ob-photo" src={ONBOARD_PHOTO} alt="" />

      <div className="onboard-top">
        <span className="brand"><i aria-hidden /> Hearth</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <div className="float-tile glass a"><span><Lamp size={18} strokeWidth={2} /></span><strong>Floor lamp</strong><small>On, 70%</small></div>
        <div className="float-tile glass b cool"><span><Snowflake size={18} strokeWidth={2} /></span><strong>22.5°</strong><small>Cooling</small></div>
        <div className="float-pill glass c"><Sun size={14} strokeWidth={2.2} /> 68% solar today</div>
      </div>

      <div className="onboard-card glass">
        <p className="kicker">{s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="body">{s.body}</p>
        <div className="onboard-actions">
          <div className="dots" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
          </div>
          <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
            {last ? "Enter my home" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
