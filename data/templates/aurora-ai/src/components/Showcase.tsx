import { Sparkle } from "lucide-react";

const POINTS = [
  {
    title: "Model-agnostic routing.",
    text: "Swap between GPT, Claude, Gemini and open models without touching a line of workflow code.",
  },
  {
    title: "Deterministic replays.",
    text: "Every run is recorded. Reproduce any output, any time, for audits or debugging.",
  },
  {
    title: "Cost guardrails.",
    text: "Per-workflow budgets with automatic downgrade paths. Our customers cut inference spend by 37% on average.",
  },
];

export default function Showcase() {
  return (
    <section className="showcase container" id="product">
      <div className="showcase-media glass">
        <img
          src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=70"
          alt="AI at work"
        />
      </div>
      <div className="showcase-copy">
        <span className="pill">Why Aurora</span>
        <h2>From prototype to production in a week, not a quarter.</h2>
        <ul className="check-list">
          {POINTS.map((p) => (
            <li key={p.title}>
              <Sparkle className="check-list-icon" size={12} fill="currentColor" strokeWidth={1} aria-hidden="true" />
              <strong>{p.title}</strong> {p.text}
            </li>
          ))}
        </ul>
        <a className="btn btn-primary" href="#pricing">Explore the platform</a>
      </div>
    </section>
  );
}
