import "../styles/onboarding.css";
import { useState } from "react";
import { SLIDES } from "../data";
import ProgressRing from "../components/ProgressRing";
import StreakFlame from "../components/StreakFlame";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <div className="ring-badge">
          <ProgressRing big background="conic-gradient(var(--accent) 252deg, color-mix(in srgb, var(--fg) 12%, transparent) 0)">
            <b>5</b><span>day loop</span>
          </ProgressRing>
        </div>
        <div className="glass">
          <span className="flame"><StreakFlame /> 41</span>
          <p className="lbl muted">Longest streak · Meditate</p>
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
          {last ? "Start my first loop" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
