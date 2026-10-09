import { Sparkle } from "lucide-react";

const MARQUEE_WORDS = [
  "BRANDING",
  "WEB DESIGN",
  "MOTION",
  "PACKAGING",
  "ART DIRECTION",
  "STRATEGY",
  "NAMING",
  "CAMPAIGNS",
];

export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
          <span key={i} className="marquee-item">
            {w}{" "}
            <span className="marquee-star">
              <Sparkle size={20} fill="currentColor" strokeWidth={1} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
