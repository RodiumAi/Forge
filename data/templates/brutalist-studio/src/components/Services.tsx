import { MoveRight } from "lucide-react";

const SERVICES = [
  {
    num: "01",
    title: "Brand identity",
    text: "Logos people actually remember. Systems that survive an intern with Canva. We've rebranded 60+ companies and only two cried.",
    color: "#ffe600",
  },
  {
    num: "02",
    title: "Websites",
    text: "Fast, weird, unforgettable. No templates, no 'hero-features-testimonials' zombie layouts. Average Lighthouse score: 98.",
    color: "#ff4911",
  },
  {
    num: "03",
    title: "Motion & 3D",
    text: "Product films, loops, launch videos. If it doesn't stop the scroll in 0.4 seconds, we redo it. On our dime.",
    color: "#1a6dff",
  },
  {
    num: "04",
    title: "Campaigns",
    text: "Out-of-home that makes people photograph a billboard. Social that gets stolen and reposted. That's the metric.",
    color: "#f5f0e8",
  },
];

export default function Services() {
  return (
    <section className="services" id="services">
      <h2 className="section-title">
        WHAT WE DO<span className="title-dot">.</span>
      </h2>
      <div className="service-grid">
        {SERVICES.map((s) => (
          <article key={s.num} className="service-card" style={{ background: s.color }}>
            <span className="service-num">{s.num}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <span className="service-arrow">
              <MoveRight size={20} strokeWidth={2.25} aria-hidden="true" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
