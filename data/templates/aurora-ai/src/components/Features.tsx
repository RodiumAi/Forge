import { Brain, ChartColumn, Globe, LockKeyhole, Puzzle, Zap } from "lucide-react";

const FEATURES = [
  {
    Icon: Brain,
    title: "Autonomous agents",
    text: "Deploy agents that triage tickets, draft replies and reconcile data across 40+ tools — with human approval gates wherever you want them.",
  },
  {
    Icon: Zap,
    title: "Sub-second inference",
    text: "Our routing layer picks the fastest capable model per request. Median latency 380ms, p99 under 1.2s, globally.",
  },
  {
    Icon: LockKeyhole,
    title: "Private by design",
    text: "SOC 2 Type II, zero data retention mode, and optional VPC deployment. Your prompts never train anyone's model.",
  },
  {
    Icon: Puzzle,
    title: "Composable workflows",
    text: "Chain models, tools and conditions in a visual builder or plain TypeScript. Version, test and roll back like real software.",
  },
  {
    Icon: ChartColumn,
    title: "Evaluation built in",
    text: "Score every output against golden datasets. Catch regressions before your users do, with automatic weekly eval runs.",
  },
  {
    Icon: Globe,
    title: "Multilingual out of the box",
    text: "94 languages with consistent tone. One workflow serves Tokyo, Berlin and São Paulo without a single branch.",
  },
];

export default function Features() {
  return (
    <section className="features container" id="features">
      <div className="section-head">
        <span className="pill">Product</span>
        <h2>Everything between the model and production.</h2>
        <p>
          The gap between a great demo and a reliable product is enormous. Aurora is the
          infrastructure that closes it.
        </p>
      </div>
      <div className="feature-grid">
        {FEATURES.map(({ Icon, title, text }) => (
          <article key={title} className="feature-card glass">
            <span className="feature-icon">
              <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
