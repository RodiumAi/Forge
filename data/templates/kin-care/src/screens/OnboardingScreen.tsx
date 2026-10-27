import { ArrowRight, CalendarCheck, HeartPulse, Plus, Star } from "lucide-react";
import { useState } from "react";
import { ONBOARD_PHOTO, SLIDES } from "../data";
import "../styles/onboarding.css";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand"><i><Plus size={18} strokeWidth={3} /></i> Kin</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>
      <div className={`onboard-art step-${slide}`} aria-hidden>
        <img src={ONBOARD_PHOTO} alt="" />
        <div className="float rating"><Star size={15} strokeWidth={0} fill="currentColor" /> 4.9 <small>312 reviews</small></div>
        <div className="float booked"><span><CalendarCheck size={17} strokeWidth={2.2} /></span><b>Booked<small>Tue 27, 10:30</small></b></div>
        <div className="float pulse"><HeartPulse size={16} strokeWidth={2.2} /> 72 bpm</div>
      </div>

      <div className="onboard-card">
        <p className="kicker">{s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="muted">{s.body}</p>
        <div className="onboard-actions">
          <div className="dots" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
          </div>
          <button className="btn-primary" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
            {last ? "Get started" : "Continue"} <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
