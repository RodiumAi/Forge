import "../styles/onboarding.css";
import { ArrowRight, GraduationCap, Lock, PenLine } from "lucide-react";
import { useState } from "react";
import Orb from "../components/Orb";
import { SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><Orb size="xs" /> Nova</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <span className="orbit o1" />
        <span className="orbit o2" />
        <Orb size="lg" state={slide === 0 ? "listening" : "idle"} />
        <div className="bubble a">Plan my week around the pitch</div>
        <div className="bubble b"><PenLine size={14} strokeWidth={2} /> Writer</div>
        <div className="bubble c"><GraduationCap size={14} strokeWidth={2} /> Tutor</div>
        <div className="bubble d"><Lock size={13} strokeWidth={2.2} /> Memory: 14 facts</div>
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
          {last ? "Start talking" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
