import "../styles/onboarding.css";
import { ArrowRight, Footprints, Timer } from "lucide-react";
import { useState } from "react";
import Rings from "../components/Rings";
import { GOALS, SLIDES, START } from "../data";

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className={`app-shell onboarding-screen step-${slide}`}>
      <div className="onboard-photo" aria-hidden>
        {SLIDES.map((x, i) => <img key={x.photo} src={x.photo} alt="" className={i === slide ? "on" : ""} />)}
        <span className="photo-shade" />
        <div className="float rings-chip"><Rings value={START} goals={GOALS} size={58} /><span><b>486</b> kcal</span></div>
        <div className="float pace-chip"><Timer size={15} strokeWidth={2.4} /><b>4:47</b>/km</div>
        <div className="float km-chip"><Footprints size={15} strokeWidth={2.4} /><b>8.4</b>km</div>
      </div>

      <div className="onboard-top">
        <span className="brand">Stride<i aria-hidden /></span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
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
          {last ? "Let's run" : "Continue"} <ArrowRight size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
