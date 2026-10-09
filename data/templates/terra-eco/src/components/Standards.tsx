import { CircleDot, Diamond, Flower, Sparkle } from "lucide-react";

const BADGES = [
  { name: "B Corp Certified", detail: "Score 118.4 — recertified 2026", icon: CircleDot },
  { name: "1% for the Planet", detail: "Member since 2020", icon: Sparkle, filled: true },
  { name: "Gold Standard", detail: "All carbon projects verified", icon: Flower },
  { name: "Science Based Targets", detail: "Net-zero pathway validated", icon: Diamond },
];

export default function Standards() {
  return (
    <section className="section" id="standards">
      <div className="section-head center">
        <span className="eyebrow">Standards & proof</span>
        <h2 className="h2">Certified, audited, published</h2>
        <p className="section-sub">
          We hold ourselves to the strictest third-party standards available —
          and publish every audit in full, including the uncomfortable parts.
        </p>
      </div>
      <div className="badge-grid">
        {BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <div className="badge" key={b.name}>
              <span className="badge-icon" aria-hidden><Icon size={26} strokeWidth={2} fill={b.filled ? "currentColor" : "none"} /></span>
              <div>
                <div className="badge-name">{b.name}</div>
                <div className="badge-detail">{b.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
