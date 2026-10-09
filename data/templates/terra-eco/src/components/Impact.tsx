import { useState } from "react";
import { Droplet, Earth, Sprout, Wheat } from "lucide-react";

const IMPACT = [
  { n: 1200000, display: "1.2M", label: "Trees planted since 2019", icon: Sprout },
  { n: 84, display: "84", label: "Regenerative farms supported", icon: Wheat },
  { n: 46000, display: "46K", label: "Tonnes of CO₂ sequestered", icon: Earth },
  { n: 310, display: "310", label: "Hectares of wetland restored", icon: Droplet },
];

export default function Impact() {
  const [counted, setCounted] = useState(false);

  return (
    <section className="impact" id="impact">
      <h2 className="h2 light">What regeneration looks like, counted.</h2>
      <p className="section-sub light">
        Every number below links to public plot data, steward names and monitoring
        reports. Click any counter in the live dashboard to drill down.
      </p>
      <div className="impact-grid" onMouseEnter={() => setCounted(true)}>
        {IMPACT.map((s) => {
          const Icon = s.icon;
          return (
            <div className={counted ? "impact-card grow" : "impact-card"} key={s.label}>
              <span className="impact-icon" aria-hidden><Icon size={30} strokeWidth={1.75} /></span>
              <div className="impact-n">{s.display}</div>
              <div className="impact-label">{s.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
