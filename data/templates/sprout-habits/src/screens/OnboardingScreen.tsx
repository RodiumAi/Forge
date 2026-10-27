import "../styles/onboarding.css";
import { ArrowRight, BookOpen, Check, Flame, GlassWater, Sprout } from "lucide-react";
import { useState } from "react";
import { ONBOARD_PHOTO, SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><i aria-hidden><Sprout size={18} strokeWidth={2.4} /></i> Sprout</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <div className="blob a" />
        <div className="blob b" />
        <div className="arch"><img src={ONBOARD_PHOTO} alt="" /></div>
        <div className="mini sky"><span><GlassWater size={16} strokeWidth={2.2} /></span><b>Drink water</b><em className="ok"><Check size={13} strokeWidth={3.2} /></em></div>
        <div className="mini butter"><span><BookOpen size={16} strokeWidth={2.2} /></span><b>Read 20 pages</b><em /></div>
        <div className="flame"><Flame size={15} strokeWidth={2.4} /> 18 days</div>
      </div>

      <div className="onboard-body">
        <p className="kicker">{s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="muted">{s.body}</p>
      </div>

      <div className="onboard-actions">
        <div className="dots" aria-hidden>
          {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
        </div>
        <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
          {last ? "Start growing" : "Continue"} <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
