import { ChartPie, Diamond, Hexagon, Sparkle, Triangle, Zap } from "lucide-react";

const features = [
  { Icon: Diamond, size: 14, filled: true, title: "Composable Blocks", text: "Assemble your pages from prebuilt sections and swap them out without touching the rest of your layout." },
  { Icon: Zap, size: 16, filled: false, title: "Zero-Weight Pages", text: "Every page ships as lean static markup, so visitors see content instantly on any connection." },
  { Icon: ChartPie, size: 15, filled: false, title: "Smart Hydration", text: "Interactive widgets wake up only when they scroll into view, keeping the main thread free." },
  { Icon: Hexagon, size: 15, filled: false, title: "Plays Well With Others", text: "Bring your favorite tooling — type checking, scoped styles, markdown content and npm packages all just work." },
  { Icon: Triangle, size: 15, filled: true, title: "Search Ready", text: "Sitemaps, feeds and structured metadata are generated for you, so discoverability is never an afterthought." },
  { Icon: Sparkle, size: 15, filled: true, title: "Guided by Makers", text: "A growing library of recipes and examples from indie builders keeps you moving when you get stuck." },
];

export default function Features() {
  return (
    <section id="features" className="features container">
      <div className="section-head">
        <h2>Everything you need to launch with confidence</h2>
        <p>
          Batteries included. Launchpath bundles the essentials so your first
          deploy already feels production grade.
        </p>
      </div>
      <div className="feature-grid">
        {features.map(({ Icon, size, filled, title, text }) => (
          <article key={title} className="feature">
            <div className="feature-icon">
              <Icon size={size} strokeWidth={filled ? 1.5 : 2} fill={filled ? "currentColor" : "none"} aria-hidden="true" />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
