import "../styles/onboarding.css";
import { useState } from "react";
import { Zap } from "lucide-react";
import { SLIDES } from "../data";
import ActivityRing from "../components/ActivityRing";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <ActivityRing big pct={84} value="8.4" unit="km today" />
        <div className="glass">
          <p className="lbl">Weekly goal</p>
          <p className="amt">32.1 <small>/ 40 km</small></p>
          <span className="pill"><Zap size={18} strokeWidth={1.7} /> 3-day streak</span>
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
          {last ? "Start running" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
