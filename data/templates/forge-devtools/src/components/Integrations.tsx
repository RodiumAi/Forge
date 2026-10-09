import { Box, Disc3, FastForward, Github, Gitlab, Zap } from "lucide-react";

const INTEGRATIONS = [
  { name: "Vite", icon: Zap },
  { name: "webpack", icon: Box },
  { name: "Rollup", icon: Disc3 },
  { name: "esbuild", icon: FastForward },
  { name: "GitHub Actions", icon: Github },
  { name: "GitLab CI", icon: Gitlab },
];

export default function Integrations() {
  return (
    <section className="section" id="integrations">
      <h2 className="h2">Plugs into what you already run</h2>
      <p className="section-sub">First-class adapters, all maintained in the core repo.</p>
      <div className="integ-grid">
        {INTEGRATIONS.map((i) => {
          const Icon = i.icon;
          return (
            <div className="integ" title={i.name} key={i.name}>
              <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
              <span>{i.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
