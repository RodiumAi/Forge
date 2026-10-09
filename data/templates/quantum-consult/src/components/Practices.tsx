import { MoveRight } from "lucide-react";

const practices = [
  {
    num: "01",
    title: "Corporate Strategy",
    text: "Portfolio design, market entry and capital allocation for boards facing consequential choices.",
  },
  {
    num: "02",
    title: "Operational Excellence",
    text: "Cost architecture, supply chain resilience and margin programs measured in basis points, not slides.",
  },
  {
    num: "03",
    title: "M&A and Integration",
    text: "Diligence, valuation discipline and the first hundred days executed against a single accountable plan.",
  },
  {
    num: "04",
    title: "Digital and Data",
    text: "Technology economics, build-versus-buy decisions and data platforms that survive audit.",
  },
];

export default function Practices() {
  return (
    <section className="practices" id="practices">
      <div className="sec-rule">
        <span className="sec-num">§1</span>
        <h2>Practice areas</h2>
      </div>
      <div className="practice-grid">
        {practices.map((p) => (
          <article className="practice" key={p.num}>
            <span className="practice-num">{p.num}</span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
            <a href="#contact" className="practice-link">
              Discuss a mandate <MoveRight size={11} strokeWidth={2} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
