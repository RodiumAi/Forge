import "../styles/onboarding.css";
import { ArrowRight, Bike, Star } from "lucide-react";
import { useState } from "react";
import { COURIER, SLIDES } from "../data";

type Props = { onFinish: () => void };

/** First launch, outside the tab shell: three photo slides, Continue / Skip. */
export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className={`app-shell onboarding-screen step-${slide}`}>
      <div className="onboard-photo" aria-hidden>
        {SLIDES.map((x, i) => <img key={x.photo} src={x.photo} alt="" className={i === slide ? "on" : ""} />)}
        <span className="photo-shade" />
        <div className="onboard-top">
          <span className="brand">mesa<i /></span>
          {!last && <button className="skip" onClick={onFinish}>Skip</button>}
        </div>
        <div className="float rate-chip">
          <span className="rate-ico"><Star size={14} strokeWidth={0} fill="currentColor" /></span>
          <span><b>4.9</b><small>2.4k reviews</small></span>
        </div>
        <div className="float eta-chip">
          <img src={COURIER.avatar} alt="" />
          <span><small>Arriving</small><b>12:48</b></span>
          <span className="eta-bike"><Bike size={15} strokeWidth={2.4} /></span>
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
          {last ? "Start ordering" : "Continue"} <ArrowRight size={19} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
