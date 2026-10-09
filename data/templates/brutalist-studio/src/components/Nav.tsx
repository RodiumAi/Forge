import { MoveRight, Star } from "lucide-react";

export default function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#top">
        RAW<Star className="brand-star" size={17} fill="currentColor" strokeWidth={0} aria-hidden="true" />WORKS
      </a>
      <nav className="nav-links">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#process">Process</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a className="btn btn-accent" href="#contact">
        START A FIGHT <MoveRight className="btn-icon" size={13} strokeWidth={3} aria-hidden="true" />
      </a>
    </header>
  );
}
