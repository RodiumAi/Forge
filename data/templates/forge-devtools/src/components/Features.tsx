import { Dna, Lock, MapIcon, Microscope, TrendingDown, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Microscope,
    title: "Byte-level attribution",
    desc: "Every byte in your bundle traced back to the exact import, loader and plugin that put it there. No more guessing which dependency ate 200 KB.",
  },
  {
    icon: Zap,
    title: "Zero-config tracing",
    desc: "Drop into any Vite, webpack, Rollup or esbuild project. Hexbin reads your existing config — you change nothing, not even one flag.",
  },
  {
    icon: TrendingDown,
    title: "Regression gates in CI",
    desc: "Fail the build when a PR adds more than your byte budget. Comments land on the PR with the exact module diff, not a vague total.",
  },
  {
    icon: Dna,
    title: "Duplicate hunting",
    desc: "Finds the three copies of lodash, the two moment builds and the polyfill nobody remembers adding — then tells you which resolution fixes it.",
  },
  {
    icon: MapIcon,
    title: "Interactive treemaps",
    desc: "Not a screenshot — a queryable map. Filter by package, author, license or age. Export as JSON for your own dashboards.",
  },
  {
    icon: Lock,
    title: "Fully local analysis",
    desc: "Your source never leaves the machine. The CLI is offline-first; the optional cloud dashboard only ever sees hashed module names.",
  },
];

export default function Features() {
  return (
    <section className="section" id="features">
      <h2 className="h2">Built for the build you actually have</h2>
      <p className="section-sub">
        Six things Hexbin does that your bundler's <code>--analyze</code> flag never will.
      </p>
      <div className="feature-grid">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <article className="feature" key={f.title}>
              <span className="feature-icon" aria-hidden><Icon /></span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
