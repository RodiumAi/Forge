import "../styles/onboarding.css";
import { useState } from "react";
import { SLIDES } from "../data";
import ProgressRing from "../components/ProgressRing";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <div className="ring-wrap">
          <ProgressRing pct={62} />
          <div className="ring-center">
            <span className="rc-lbl">Left</span>
            <span className="rc-amt">760</span>
            <span className="rc-sub">of 2,000</span>
          </div>
        </div>
      </div>
      <div className="onboard-body">
        <p className="onboard-kicker">{s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="muted">{s.body}</p>
      </div>
      <div className="onboard-actions">
        <div className="dots" aria-hidden>
          {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
        </div>
        <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
          {last ? "Start budgeting" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
