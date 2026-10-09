import "../styles/onboarding.css";
import { useState } from "react";
import BoltIcon from "../components/BoltIcon";
import MapLayers from "../components/MapLayers";
import { SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <MapLayers routeClass="onboard-route" viewBox="0 0 300 300" path="M40 250 C 90 190, 120 210, 160 150 S 230 70, 262 52" />
        <div className="glass">
          <p className="lbl muted" style={{ fontSize: ".72rem" }}>Nearest driver</p>
          <p className="amt">2 min <small>away</small></p>
          <span className="pill"><BoltIcon /> Eco · 2,400 CFA</span>
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
          {last ? "Get started" : "Continue"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
