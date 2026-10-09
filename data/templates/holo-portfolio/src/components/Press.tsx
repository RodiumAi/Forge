import { Sparkle } from "lucide-react";

const press = [
  "AWWWARDS × SITE OF THE DAY",
  "FWA × PROJECT OF THE MONTH",
  "WIRED × FEATURED ARTIST",
  "IT'S NICE THAT × INTERVIEW",
];

export default function Press() {
  return (
    <div className="press" aria-hidden="true">
      <div className="press-track">
        {[0, 1].map((n) => (
          <span key={n} className="press-seg">
            {press.map((p) => (
              <span className="press-item" key={p}>
                {p} <Sparkle className="press-star" fill="currentColor" strokeWidth={0} />{" "}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
