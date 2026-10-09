import { useState } from "react";
import { Flower, Menu, X } from "lucide-react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="nav-wrap">
      <nav className="nav">
        <a className="logo" href="#top">
          <span className="logo-dot"><Flower size={16} aria-hidden="true" /></span> Bloom Studio
        </a>
        <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#treatments">Treatments</a>
          <a href="#schedule">Classes</a>
          <a href="#ritual">The Ritual</a>
          <a href="#stories">Stories</a>
          <a href="#visit" className="nav-cta">Book a visit</a>
        </div>
      </nav>
    </header>
  );
}
