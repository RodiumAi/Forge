import "../styles/onboarding.css";
import { useState } from "react";
import { Leaf } from "lucide-react";
import { SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <span className="leaf-glyph big"><Leaf size={96} strokeWidth={1.4} fill="currentColor" fillOpacity={0.22} aria-hidden /></span>
        <div className="glass">
          <p className="lbl muted" style={{ fontSize: ".72rem" }}>Watering today</p>
          <p className="amt">3 <small>plants</small></p>
          <span className="pill">7-day streak</span>
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
          {last ? "Start growing" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
