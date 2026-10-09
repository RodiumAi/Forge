import { Play } from "lucide-react";

export default function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#top">NEON<span className="brand-alt">NIGHTS</span></a>
      <nav className="nav-links">
        <a href="#music">Music</a>
        <a href="#tracks">Tracklist</a>
        <a href="#tour">Tour</a>
        <a href="#about">About</a>
      </nav>
      <a className="btn btn-neon" href="#music">
        <Play size={14} fill="currentColor" aria-hidden="true" />
        Listen now
      </a>
    </header>
  );
}
