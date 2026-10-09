import "../styles/onboarding.css";
import { useState } from "react";
import { Heart } from "lucide-react";
import { AVA, SLIDES, fb, photo } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-art" aria-hidden>
        <div className="ob-photo" style={{ backgroundImage: fb(1) }}>
          <img src={photo("photo-1523275335684-37898b6baf30", 640)} alt="" />
        </div>
        <div className="ob-card">
          <span className="ob-ring"><img src={photo(AVA.maya, 120)} alt="" /></span>
          <div><strong>maya.k</strong><span>liked your photo</span></div>
          <span className="ob-heart"><Heart size={22} strokeWidth={1.8} fill="currentColor" aria-hidden /></span>
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
          {last ? "Join Frame" : "Next"}
        </button>
        <button className="btn-ghost" onClick={onFinish}>Skip</button>
      </div>
    </div>
  );
}
