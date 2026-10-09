const TESTIMONIALS = [
  {
    quote:
      "We replaced three internal tools with a single Aurora workflow. Support resolution time dropped from 9 hours to 41 minutes.",
    name: "Maya Lindqvist",
    role: "VP Operations, Fernbrook",
  },
  {
    quote:
      "The eval suite is the killer feature. We ship prompt changes daily now because regressions get caught automatically.",
    name: "Daniel Okafor",
    role: "Head of AI, Klarwave",
  },
  {
    quote:
      "Aurora's VPC deployment cleared our security review in two weeks. Every other vendor took months or failed outright.",
    name: "Sophie Marchetti",
    role: "CISO, Nordbank Digital",
  },
];

export default function Testimonials() {
  return (
    <section className="testimonials container">
      <div className="section-head">
        <span className="pill">Customers</span>
        <h2>Loved by operators, trusted by security teams.</h2>
      </div>
      <div className="quote-grid">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="quote glass">
            <span className="quote-mark">“</span>
            <blockquote>{t.quote}</blockquote>
            <figcaption>
              <strong>{t.name}</strong>
              <span>{t.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
