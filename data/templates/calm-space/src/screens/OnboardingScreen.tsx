import "../styles/onboarding.css";
import { useState } from "react";
import { SLIDES } from "../data";

type Props = { breathing: boolean; onFinish: () => void };

export default function OnboardingScreen({ breathing, onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <div className={breathing ? "orb breathing" : "orb"} />
        <div className="glass">
          <p className="lbl muted" style={{ fontSize: ".72rem" }}>Tonight</p>
          <p className="amt">7h 42m <small>slept</small></p>
          <span className="pill">12-day streak</span>
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
          {last ? "Begin your practice" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
