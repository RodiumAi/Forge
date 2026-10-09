import { BarChart3, Bell, Compass, Puzzle, ShieldCheck, Zap } from "lucide-react";

const features = [
  { icon: Zap, title: "Instant changelogs", text: "Turn merged pull requests into polished release notes your customers actually read." },
  { icon: Compass, title: "Guided rollouts", text: "Ship to 1%, watch the metrics, then widen the audience with a single click." },
  { icon: Bell, title: "Smart notifications", text: "Announce updates in-app, by email or on Slack without writing the same post three times." },
  { icon: BarChart3, title: "Adoption analytics", text: "See which features get used within hours of release, not weeks later in a spreadsheet." },
  { icon: ShieldCheck, title: "Approval workflows", text: "Legal and marketing review drafts in one place before anything goes public." },
  { icon: Puzzle, title: "Open API", text: "Pipe release data anywhere with webhooks and a friendly, well-documented REST API." },
];

export default function Features() {
  return (
    <section id="features" className="features">
      <h2>Everything a release needs</h2>
      <p className="section-lead">From draft to adoption report, without leaving Pulsedeck.</p>
      <div className="feature-grid">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <article key={f.title} className="feature-card">
              <span className="feature-icon">
                <Icon aria-hidden="true" />
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
