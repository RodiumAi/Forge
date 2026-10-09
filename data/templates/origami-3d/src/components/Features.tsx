import { Diamond, Hexagon, PanelLeft } from "lucide-react";

const isoCards = [
  {
    icon: PanelLeft,
    title: "Live parametric surfaces",
    text: "Drag a slider, watch the whole assembly re-solve in under 16ms. Constraints propagate across every folded panel.",
  },
  {
    icon: Hexagon,
    title: "Version-controlled geometry",
    text: "Every fold, extrude and boolean lands in a diff you can read. Branch a prototype like you branch code.",
  },
  {
    icon: Diamond,
    title: "One-click fabrication export",
    text: "Flatten to DXF for laser cutting, export STEP for CNC, or ship straight to our print network in 40 cities.",
  },
];

export default function Features() {
  return (
    <section className="section section-alt" id="features">
      <div className="section-head">
        <h2 className="section-title">Engineered for the way parts actually get made</h2>
        <p className="section-sub">Every feature exists because a prototype failed without it.</p>
      </div>
      <div className="iso-grid">
        {isoCards.map((c) => {
          const Icon = c.icon;
          return (
            <div className="iso-wrap" key={c.title}>
              <div className="iso-card">
                <span className="iso-icon"><Icon size={36} strokeWidth={1.75} /></span>
              </div>
              <h3 className="iso-title">{c.title}</h3>
              <p className="iso-text">{c.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
