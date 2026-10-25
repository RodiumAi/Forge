import "../styles/onboarding.css";
import { ArrowRight, Headphones, Quote } from "lucide-react";
import { useState } from "react";
import BookCover from "../components/BookCover";
import { BOOKS, SLIDES, bookById } from "../data";

type Props = { onFinish: () => void };

const FAN = ["cartographer", "harmattan", "rain-grammar"].map((id) => bookById(id) ?? BOOKS[0]);

export default function OnboardingScreen({ onFinish }: Props) {
  const [slide, setSlide] = useState(0);
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="app-shell onboarding-screen">
      <div className="onboard-top">
        <span className="brand">Folio<i aria-hidden>.</i></span>
        {!last && <button className="skip" onClick={onFinish}>Skip</button>}
      </div>

      <div className={`onboard-art step-${slide}`} aria-hidden>
        <div className="halo" />
        {FAN.map((b, i) => (
          <span key={b.id} className={`fan f${i}`}><BookCover book={b} size={i === 1 ? "lg" : "md"} /></span>
        ))}
        <div className="float-chip a"><Headphones size={14} strokeWidth={2.2} /> 9 h 12 min</div>
        <div className="float-chip b"><Quote size={13} strokeWidth={2.2} /> <em>Chapter 4</em> &middot; 64%</div>
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
          {last ? "Open my library" : "Continue"} <ArrowRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
