import { MoveRight } from "lucide-react";

const NAV = ["Program", "Speakers", "Venue", "Tickets"];

export default function Topbar() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        KINETIC<span className="brand-year">27</span>
      </a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
        ))}
      </nav>
      <a className="btn btn-fg" href="#tickets">
        Get tickets <MoveRight className="btn-icon" size={14} strokeWidth={2.5} aria-hidden="true" />
      </a>
    </header>
  );
}
