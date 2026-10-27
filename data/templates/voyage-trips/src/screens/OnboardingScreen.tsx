import "../styles/onboarding.css";
import { ArrowRight, Heart, MapPin, Plane } from "lucide-react";
import { useState } from "react";
import { byId, SLIDES } from "../data";

const FAN = ["kyoto", "santorini", "braies"].map((id) => byId(id));

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand">Voyage</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        {FAN.map((d, i) => d && (
          <figure key={d.id} className={`fan f${i}`}>
            <img src={d.photo} alt="" />
            <figcaption><span>{d.name}</span><small><MapPin size={11} strokeWidth={2.4} /> {d.country}</small></figcaption>
          </figure>
        ))}
        <span className="float-chip a"><Heart size={14} strokeWidth={2.4} fill="currentColor" /> Saved</span>
        <span className="float-chip b"><Plane size={14} strokeWidth={2.4} /> COO to JTR · 07:40</span>
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
          {last ? "Start exploring" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
