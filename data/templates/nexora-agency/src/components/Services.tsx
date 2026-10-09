import { ArrowRight, Cloud, Command, Diamond, SquareSquare } from "lucide-react";

const services = [
  { Icon: Diamond, title: "Product Discovery", text: "Workshops and user research that turn vague ideas into a roadmap the whole team believes in." },
  { Icon: SquareSquare, title: "Interface Design", text: "Design systems and high-fidelity prototypes engineered to move users toward action." },
  { Icon: Command, title: "App Engineering", text: "Robust web applications on modern stacks, shipped in tight iterations with full test coverage." },
  { Icon: Cloud, title: "Infra and Delivery", text: "Deployment pipelines, observability and cloud setups that keep releases boring and fast." },
];

export default function Services() {
  return (
    <section id="services" className="services container">
      <p className="eyebrow">What we do</p>
      <h2>Capabilities built for modern product teams</h2>
      <div className="service-grid">
        {services.map(({ Icon, title, text }) => (
          <article key={title} className="service-card">
            <div className="service-icon">
              <Icon size={18} aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
            <a className="more" href="#">
              Learn more <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
