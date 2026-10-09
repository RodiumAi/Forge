import { Hexagon, Plus, Star } from "lucide-react";

const NAV = ["Features", "Compare", "Integrations", "Open Source", "Docs"];

export default function Nav() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brand-mark" aria-hidden="true">
          <Hexagon size={24} strokeWidth={2} className="brand-hex" />
          <Plus size={14} strokeWidth={3.4} className="brand-plus" />
        </span>
        hexbin
      </a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n} href={`#${n.toLowerCase().replace(" ", "-")}`}>{n}</a>
        ))}
      </nav>
      <div className="topbar-actions">
        <a className="btn btn-ghost" href="#open-source">
          <Star className="btn-icon" fill="currentColor" strokeWidth={0} aria-hidden="true" /> 24.8k
        </a>
        <a className="btn btn-accent" href="#install">Install</a>
      </div>
    </header>
  );
}
