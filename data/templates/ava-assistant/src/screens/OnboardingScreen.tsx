import "../styles/onboarding.css";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import SparkIcon from "../components/SparkIcon";
import { SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <span className="orb" />
        <div className="glass">
          <span className="ava-badge"><SparkIcon /></span>
          <p className="bub">How can I help?</p>
          <p className="bub me">Plan my launch week <Sparkles className="bub-ic" size={14} strokeWidth={2} aria-hidden /></p>
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
          {last ? "Start chatting" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
