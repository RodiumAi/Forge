import { Diamond, Triangle, TriangleRight } from "lucide-react";

const services = [
  { icon: TriangleRight, filled: true, title: "Immersive Web", text: "Sites that feel like installations. WebGL, scroll choreography, zero templates." },
  { icon: Diamond, filled: false, title: "Live Visuals", text: "Stage and installation graphics driven by sound, data or crowd motion." },
  { icon: Triangle, filled: false, title: "Identity in Motion", text: "Brand systems designed to move first and print second." },
];

export default function Services() {
  return (
    <section className="services" id="services">
      <h2 className="section-title">
        WHAT I <span className="mega-grad">DO</span>
      </h2>
      <div className="service-grid">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <article className="service" key={s.title}>
              <span className="service-icon">
                <Icon fill={s.filled ? "currentColor" : "none"} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
