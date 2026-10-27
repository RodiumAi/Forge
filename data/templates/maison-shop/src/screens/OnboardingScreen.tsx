import "../styles/onboarding.css";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { EDITORIAL, PRODUCTS, SLIDES } from "../data";

const ART = [EDITORIAL.cover, PRODUCTS[1].images[0], PRODUCTS[4].images[0]];

type Props = { onFinish: () => void };

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-photo" aria-hidden>
        {ART.map((src, i) => (
          <img key={src} src={src} alt="" className={i === slide ? "on" : ""} />
        ))}
        <span className="onboard-shade" />
      </div>

      <div className="onboard-top">
        <span className="brand">Maison</span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className="onboard-body">
        <p className="label">{String(slide + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")} · {s.kicker}</p>
        <h2>{s.title}</h2>
        <p className="lede">{s.body}</p>
        <div className="onboard-actions">
          <div className="bars" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i <= slide ? "on" : ""} />)}
          </div>
          <button className="btn-light" onClick={() => (last ? onFinish() : setSlide((n) => n + 1))}>
            {last ? "Enter the shop" : "Next"} <ArrowRight size={16} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
