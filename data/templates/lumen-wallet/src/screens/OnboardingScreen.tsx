import "../styles/onboarding.css";
import { ArrowRight, ArrowUpRight, Wifi } from "lucide-react";
import { useState } from "react";
import { BALANCE, CONTACTS, CURRENCY, SLIDES } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><i aria-hidden /> Lumen</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <div className="glow" />
        <div className="mini-card">
          <div className="row-top"><span>Lumen</span><Wifi size={16} strokeWidth={2} /></div>
          <p className="mini-amt">{BALANCE.total} <small>{CURRENCY}</small></p>
          <p className="mini-num">•••• 4821</p>
        </div>
        <div className="float-chip a"><ArrowUpRight size={14} strokeWidth={2.4} /> 25 000 sent</div>
        <div className="float-chip b">
          {CONTACTS.slice(0, 3).map((c) => <img key={c.id} src={c.avatar} alt="" />)}
          <span>+12</span>
        </div>
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
          {last ? "Open my account" : "Continue"} <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
