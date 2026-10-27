import "../styles/onboarding.css";
import { ArrowRight, AudioLines, Download } from "lucide-react";
import { useState } from "react";
import { ALBUMS, SLIDES } from "../data";

const STACK = ALBUMS.slice(0, 3);

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><i aria-hidden /> Vinyl</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <div className="glow" />
        <div className="record"><img src={STACK[slide].cover} alt="" /></div>
        {STACK.map((a, i) => (
          <img key={a.id} className={`sleeve s${i}`} src={a.cover} alt="" />
        ))}
        <span className="float-chip a"><AudioLines size={14} strokeWidth={2.4} /> Lossless</span>
        <span className="float-chip b"><Download size={14} strokeWidth={2.4} /> 50 songs offline</span>
      </div>

      <div className="onboard-body">
        <p className="kicker">{s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="muted">{s.body}</p>
      </div>

      <div className="onboard-actions">
        <div className="dots" aria-hidden>
          {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
        </div>
        <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
          {last ? "Start listening" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
