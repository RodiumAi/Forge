import "../styles/onboarding.css";
import { useState } from "react";
import { PRODUCTS, SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <div className="tile" style={{ backgroundImage: PRODUCTS[1].grad }}>
          <img src={PRODUCTS[1].img} alt="" />
        </div>
        <div className="tile small" style={{ backgroundImage: PRODUCTS[0].grad }}>
          <img src={PRODUCTS[0].img} alt="" />
        </div>
        <div className="glass">
          <span className="pill">Free shipping over $75</span>
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
          {last ? "Start shopping" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
