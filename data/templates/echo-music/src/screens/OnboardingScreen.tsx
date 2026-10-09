import "../styles/onboarding.css";
import { useState } from "react";
import { SLIDES } from "../data";

const EQ = [38, 72, 52, 90, 44, 66, 30];

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <div className="eq">
          {EQ.map((h, i) => (
            <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
          ))}
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
          {last ? "Start listening" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
