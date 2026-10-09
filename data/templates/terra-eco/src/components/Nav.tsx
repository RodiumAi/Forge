import { Leaf } from "lucide-react";

const NAV = ["Mission", "Impact", "Projects", "Standards", "Join"];

export default function Nav() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brand-mark" aria-hidden><Leaf size={20} fill="currentColor" /></span> Terra Collective
      </a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
        ))}
      </nav>
      <a className="btn btn-accent" href="#join">Support a project</a>
    </header>
  );
}
