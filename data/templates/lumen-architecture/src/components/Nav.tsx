import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="nav">
      <a className="nav-logo" href="#top">
        Lumen<span className="nav-logo-dot">.</span>Atelier
      </a>
      <nav className={"nav-links" + (menuOpen ? " open" : "")}>
        <a href="#work" onClick={() => setMenuOpen(false)}>Work</a>
        <a href="#philosophy" onClick={() => setMenuOpen(false)}>Philosophy</a>
        <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
        <a href="#studio" onClick={() => setMenuOpen(false)}>Studio</a>
        <a href="#contact" className="nav-cta" onClick={() => setMenuOpen(false)}>
          Start a project
        </a>
      </nav>
      <button
        className="nav-burger"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
  );
}
